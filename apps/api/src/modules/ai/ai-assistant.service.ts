import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AIChat,
  AIMessage,
  Case,
  CaseParty,
  CaseTimeline,
  Draft,
  Judgement,
} from '@prisma/client';
import {
  AIChatRole,
  AIIntent,
  type AIChatView,
  type AIMessageView,
  type CitationView,
  type DraftView,
  type TemplateType,
} from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../integrations/ai/ai.service';
import type { ChatMessage } from '../../integrations/ai/ai.types';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateDraftDto } from './dto/create-draft.dto';

type ChatWithMessages = AIChat & { messages: AIMessage[] };
type CaseContext = Case & { parties: CaseParty[]; timeline: CaseTimeline[] };

/**
 * AI Assistant: legal chat + document drafting for Indian litigators.
 * Chats are scoped to the authenticated user (userId); drafts to the lawyer.
 */
@Injectable()
export class AiAssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  // ------------------------------------------------------------------------
  // Chats
  // ------------------------------------------------------------------------

  async listChats(userId: string): Promise<AIChatView[]> {
    const chats = await this.prisma.aIChat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return chats.map((c) => this.toChatView(c));
  }

  async createChat(userId: string, dto: CreateChatDto): Promise<AIChatView> {
    if (dto.caseId) {
      await this.assertCaseAccessible(userId, dto.caseId);
    }
    const chat = await this.prisma.aIChat.create({
      data: {
        userId,
        caseId: dto.caseId ?? null,
        title: dto.title?.trim() || 'New chat',
        intent: AIIntent.GENERAL,
      },
    });
    return this.toChatView(chat);
  }

  async getChat(userId: string, chatId: string): Promise<AIChatView> {
    const chat = await this.loadOwnedChat(userId, chatId, true);
    return this.toChatView(chat, chat.messages);
  }

  async deleteChat(userId: string, chatId: string): Promise<void> {
    await this.loadOwnedChat(userId, chatId, false);
    await this.prisma.aIChat.delete({ where: { id: chatId } });
  }

  /**
   * Persists the user's message, builds a legal context prompt (optionally
   * grounded in the linked case), calls the LLM, persists the assistant reply
   * and returns both. Lets ServiceUnavailableException from the integration
   * propagate so the controller surfaces a 503 when no key is configured.
   */
  async sendMessage(
    userId: string,
    chatId: string,
    dto: SendMessageDto,
  ): Promise<{ message: AIMessageView; reply: AIMessageView }> {
    const chat = await this.loadOwnedChat(userId, chatId, true);

    const userMessage = await this.prisma.aIMessage.create({
      data: { chatId: chat.id, role: AIChatRole.USER, content: dto.content },
    });

    const caseContext = chat.caseId ? await this.loadCaseContext(userId, chat.caseId) : null;
    const system = this.buildChatSystemPrompt(caseContext);

    const history: ChatMessage[] = [...chat.messages, userMessage]
      .filter((m) => m.role === AIChatRole.USER || m.role === AIChatRole.ASSISTANT)
      .map((m) => ({
        role: m.role === AIChatRole.ASSISTANT ? 'assistant' : 'user',
        content: m.content,
      }));

    const result = await this.ai.chat(history, { system });

    const assistantMessage = await this.prisma.aIMessage.create({
      data: {
        chatId: chat.id,
        role: AIChatRole.ASSISTANT,
        content: result.content,
        tokensIn: result.usage?.inputTokens ?? null,
        tokensOut: result.usage?.outputTokens ?? null,
      },
    });

    // Bump the chat so it sorts to the top of the list.
    await this.prisma.aIChat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    return {
      message: this.toMessageView(userMessage),
      reply: this.toMessageView(assistantMessage),
    };
  }

  // ------------------------------------------------------------------------
  // Drafting
  // ------------------------------------------------------------------------

  async listDrafts(lawyerId: string, caseId?: string): Promise<DraftView[]> {
    const drafts = await this.prisma.draft.findMany({
      where: { lawyerId, ...(caseId ? { caseId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return drafts.map((d) => this.toDraftView(d));
  }

  async getDraft(lawyerId: string, draftId: string): Promise<DraftView> {
    const draft = await this.prisma.draft.findUnique({ where: { id: draftId } });
    if (!draft || draft.lawyerId !== lawyerId) {
      throw new NotFoundException('Draft not found');
    }
    return this.toDraftView(draft);
  }

  /**
   * Drafting pipeline: load case context (if any), pull relevant authorities,
   * build a strong India-specific drafting prompt, call the LLM and persist a
   * Draft row with the authorities it was grounded on as citations.
   */
  async createDraft(
    userId: string,
    lawyerId: string,
    dto: CreateDraftDto,
  ): Promise<DraftView> {
    const caseContext = dto.caseId ? await this.loadCaseContext(userId, dto.caseId) : null;
    const authorities = await this.findRelevantJudgements(dto, caseContext);

    const system = this.buildDraftSystemPrompt(dto.templateType);
    const userPrompt = this.buildDraftUserPrompt(dto, caseContext, authorities);

    const result = await this.ai.chat([{ role: 'user', content: userPrompt }], { system });

    const citations = authorities.map((j) => this.toCitation(j));
    const draft = await this.prisma.draft.create({
      data: {
        lawyerId,
        caseId: dto.caseId ?? null,
        title: this.deriveDraftTitle(dto),
        content: result.content,
        templateType: dto.templateType ?? null,
        citations: citations as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toDraftView(draft);
  }

  // ------------------------------------------------------------------------
  // Context loading + ownership
  // ------------------------------------------------------------------------

  private async loadOwnedChat(
    userId: string,
    chatId: string,
    withMessages: boolean,
  ): Promise<ChatWithMessages> {
    const chat = await this.prisma.aIChat.findUnique({
      where: { id: chatId },
      include: withMessages
        ? { messages: { orderBy: { createdAt: 'asc' } } }
        : undefined,
    });
    if (!chat || chat.userId !== userId) {
      throw new NotFoundException('Chat not found');
    }
    return { ...chat, messages: (chat as ChatWithMessages).messages ?? [] };
  }

  /** Loads a case owned by the caller (via their lawyer) with parties + recent timeline. */
  private async loadCaseContext(userId: string, caseId: string): Promise<CaseContext | null> {
    const kase = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        lawyer: { select: { userId: true } },
        parties: true,
        timeline: { orderBy: { eventDate: 'desc' }, take: 8 },
      },
    });
    if (!kase || kase.lawyer.userId !== userId) return null;
    return kase;
  }

  private async assertCaseAccessible(userId: string, caseId: string): Promise<void> {
    const kase = await this.loadCaseContext(userId, caseId);
    if (!kase) throw new NotFoundException('Case not found');
  }

  /**
   * Best-effort authority lookup: matches Judgements on the case practice area
   * and on keywords pulled from the prompt (title/summary ILIKE). Returns up to
   * ~5 rows; safe to return an empty list.
   */
  private async findRelevantJudgements(
    dto: CreateDraftDto,
    caseContext: CaseContext | null,
  ): Promise<Judgement[]> {
    const practiceArea = caseContext?.practiceArea ?? null;
    const keywords = this.extractKeywords(dto.prompt);

    const orFilters: Prisma.JudgementWhereInput[] = keywords.flatMap((kw) => [
      { title: { contains: kw, mode: 'insensitive' as const } },
      { summary: { contains: kw, mode: 'insensitive' as const } },
    ]);

    const where: Prisma.JudgementWhereInput = {};
    if (practiceArea) where.practiceArea = practiceArea;
    if (orFilters.length > 0) where.OR = orFilters;

    // Nothing to match on -> skip the query entirely.
    if (!practiceArea && orFilters.length === 0) return [];

    try {
      return await this.prisma.judgement.findMany({
        where,
        orderBy: { decidedAt: 'desc' },
        take: 5,
      });
    } catch {
      // Never let citation lookup block a draft.
      return [];
    }
  }

  private extractKeywords(prompt: string): string[] {
    const stop = new Set([
      'the', 'and', 'for', 'with', 'that', 'this', 'from', 'draft', 'please',
      'about', 'under', 'into', 'against', 'regarding', 'their', 'have', 'been',
      'shall', 'would', 'should', 'legal', 'notice', 'petition', 'court',
    ]);
    const seen = new Set<string>();
    const words: string[] = [];
    for (const raw of prompt.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < 4 || stop.has(raw) || seen.has(raw)) continue;
      seen.add(raw);
      words.push(raw);
      if (words.length >= 6) break;
    }
    return words;
  }

  // ------------------------------------------------------------------------
  // Prompt building
  // ------------------------------------------------------------------------

  private readonly baseIdentity =
    'You are Anura, an AI legal assistant built for advocates and litigators practising in India. ' +
    'You are fluent in Indian statutory law, the Constitution of India, the Bharatiya Nyaya Sanhita and legacy IPC/CrPC/CPC provisions, ' +
    'the Indian Evidence Act / Bharatiya Sakshya Adhiniyam, procedure before the Supreme Court, High Courts, District Courts, tribunals and consumer forums, ' +
    'and the conventions of Indian court drafting (cause titles, prayers, verifications, affidavits). ' +
    'Cite provisions and precedents precisely; when you are unsure of an exact citation, say so rather than inventing one. ' +
    'Be practical and concise, use Indian legal terminology and INR, and never fabricate case law or facts. ' +
    'You assist with drafting and analysis only and do not replace independent professional judgement.';

  private buildChatSystemPrompt(caseContext: CaseContext | null): string {
    const parts = [this.baseIdentity];
    if (caseContext) {
      parts.push(
        'The user is working on the following matter. Use it as context when relevant:\n' +
          this.summariseCase(caseContext),
      );
    }
    return parts.join('\n\n');
  }

  private buildDraftSystemPrompt(templateType?: TemplateType | null): string {
    const kind = templateType ? templateType.toLowerCase() : 'legal document';
    return (
      this.baseIdentity +
      '\n\n' +
      `You are now acting as a drafting engine. Produce a formal, filing-ready Indian ${kind}. ` +
      'Follow standard Indian court formatting: an appropriate cause title / heading, numbered paragraphs, ' +
      'a clear statement of facts, grounds with statutory and case-law references where apt, a prayer clause, ' +
      'and a verification / signature block as appropriate to the document type. ' +
      'Where authorities are provided, weave the relevant ones into the grounds and refer to them by their citation. ' +
      'Use placeholders in square brackets (e.g. [Name of Party], [Date]) for details that are not supplied. ' +
      'Output only the draft document itself, with no preamble or commentary.'
    );
  }

  private buildDraftUserPrompt(
    dto: CreateDraftDto,
    caseContext: CaseContext | null,
    authorities: Judgement[],
  ): string {
    const sections: string[] = [];
    sections.push(`Drafting instruction: ${dto.prompt}`);
    if (dto.templateType) sections.push(`Document type: ${dto.templateType}`);

    if (caseContext) {
      sections.push('Case context:\n' + this.summariseCase(caseContext));
    }

    if (authorities.length > 0) {
      const list = authorities
        .map((j, i) => {
          const cite = [j.citation, j.court].filter(Boolean).join(', ');
          const head = cite ? `${j.title} (${cite})` : j.title;
          const summary = j.summary ? ` - ${j.summary.slice(0, 300)}` : '';
          return `${i + 1}. ${head}${summary}`;
        })
        .join('\n');
      sections.push(
        'Authorities you may cite where relevant (do not cite any you do not actually rely on):\n' + list,
      );
    } else {
      sections.push(
        'No specific authorities were retrieved. Cite only settled, well-known provisions or precedents you are confident about.',
      );
    }

    return sections.join('\n\n');
  }

  private summariseCase(kase: CaseContext): string {
    const lines: string[] = [];
    lines.push(`Title: ${kase.title}`);
    if (kase.caseNumber) lines.push(`Case number: ${kase.caseNumber}`);
    if (kase.cnr) lines.push(`CNR: ${kase.cnr}`);
    if (kase.court || kase.courtType) {
      lines.push(`Court: ${[kase.court, kase.courtType].filter(Boolean).join(' / ')}`);
    }
    if (kase.jurisdiction) lines.push(`Jurisdiction: ${kase.jurisdiction}`);
    if (kase.practiceArea) lines.push(`Practice area: ${kase.practiceArea}`);
    if (kase.clientName) lines.push(`Client: ${kase.clientName}`);
    lines.push(`Status: ${kase.status}`);
    if (kase.nextHearingDate) {
      lines.push(`Next hearing: ${kase.nextHearingDate.toISOString().slice(0, 10)}`);
    }
    if (kase.description) lines.push(`Description: ${kase.description.slice(0, 500)}`);

    if (kase.parties.length > 0) {
      const parties = kase.parties
        .map((p) => `${p.name} (${p.role}${p.isClient ? ', client' : ''})`)
        .join('; ');
      lines.push(`Parties: ${parties}`);
    }

    if (kase.timeline.length > 0) {
      const events = kase.timeline
        .slice(0, 6)
        .map((e) => `${e.eventDate.toISOString().slice(0, 10)} ${e.type}: ${e.title}`)
        .join('\n');
      lines.push(`Recent timeline:\n${events}`);
    }

    return lines.join('\n');
  }

  private deriveDraftTitle(dto: CreateDraftDto): string {
    const label = dto.templateType
      ? dto.templateType.charAt(0) + dto.templateType.slice(1).toLowerCase()
      : 'Draft';
    const gist = dto.prompt.trim().replace(/\s+/g, ' ').slice(0, 60);
    return gist ? `${label}: ${gist}` : label;
  }

  // ------------------------------------------------------------------------
  // Mappers
  // ------------------------------------------------------------------------

  private toChatView(chat: AIChat, messages?: AIMessage[]): AIChatView {
    return {
      id: chat.id,
      title: chat.title,
      caseId: chat.caseId,
      createdAt: chat.createdAt.toISOString(),
      updatedAt: chat.updatedAt.toISOString(),
      ...(messages ? { messages: messages.map((m) => this.toMessageView(m)) } : {}),
    };
  }

  private toMessageView(message: AIMessage): AIMessageView {
    const citations = this.parseCitations(message.citations);
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      ...(citations.length > 0 ? { citations } : {}),
      createdAt: message.createdAt.toISOString(),
    };
  }

  private toDraftView(draft: Draft): DraftView {
    return {
      id: draft.id,
      title: draft.title,
      content: draft.content,
      caseId: draft.caseId,
      templateType: draft.templateType,
      citations: this.parseCitations(draft.citations),
      createdAt: draft.createdAt.toISOString(),
    };
  }

  private toCitation(j: Judgement): CitationView {
    return {
      title: j.title,
      court: j.court,
      citation: j.citation,
      judgementId: j.id,
    };
  }

  private parseCitations(value: unknown): CitationView[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .map((c) => ({
        title: String(c.title ?? ''),
        court: (c.court as string | null) ?? null,
        citation: (c.citation as string | null) ?? null,
        judgementId: (c.judgementId as string | null) ?? null,
      }));
  }
}
