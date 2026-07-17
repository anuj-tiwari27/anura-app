import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Case,
  CaseNote,
  CaseParty,
  CaseTimeline,
  User,
} from '@prisma/client';
import type {
  CaseDetailView,
  CaseNoteView,
  CasePartyView,
  CaseSummaryView,
  Paginated,
  TimelineEventView,
} from '@anura/shared';
import { CaseStatus, TimelineEventType } from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { paginated, skipTake } from '../../common/dto/pagination.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { QueryCasesDto } from './dto/query-cases.dto';
import { CreatePartyDto } from './dto/create-party.dto';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { CreateNoteDto } from './dto/create-note.dto';

/** A Case row loaded with everything the detail view needs. */
type CaseWithRelations = Case & {
  parties: CaseParty[];
  timeline: CaseTimeline[];
  notes: (CaseNote & { author: Pick<User, 'fullName'> | null })[];
  _count: { parties: number; documents: number };
};

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------

  /** Ensures the caller has completed onboarding and returns the lawyerId. */
  private requireLawyer(lawyerId: string | null | undefined): string {
    if (!lawyerId) {
      throw new BadRequestException('Complete onboarding first');
    }
    return lawyerId;
  }

  /** Loads a case scoped to the lawyer, or throws NotFound. */
  private async findOwnedCaseOrThrow(id: string, lawyerId: string): Promise<Case> {
    const found = await this.prisma.case.findFirst({ where: { id, lawyerId } });
    if (!found) {
      throw new NotFoundException('Case not found');
    }
    return found;
  }

  // ---------------------------------------------------------------------------
  // Cases CRUD
  // ---------------------------------------------------------------------------

  async list(lawyerIdRaw: string | null | undefined, query: QueryCasesDto): Promise<Paginated<CaseSummaryView>> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);
    const { page = 1, pageSize = 20, search, status } = query;

    const where: Prisma.CaseWhereInput = { lawyerId };
    if (status) {
      where.status = status;
    }
    if (search && search.trim().length > 0) {
      const contains = search.trim();
      where.OR = [
        { title: { contains, mode: 'insensitive' } },
        { caseNumber: { contains, mode: 'insensitive' } },
        { clientName: { contains, mode: 'insensitive' } },
      ];
    }

    const { skip, take } = skipTake(page, pageSize);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          _count: { select: { parties: true, documents: true } },
          parties: { where: { isClient: true }, take: 1, select: { name: true } },
        },
      }),
      this.prisma.case.count({ where }),
    ]);

    const items = rows.map((row) => this.toSummary(row, row._count, row.parties[0]?.name ?? null));
    return paginated(items, total, page, pageSize);
  }

  async create(lawyerIdRaw: string | null | undefined, dto: CreateCaseDto): Promise<CaseDetailView> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);

    const nextHearingDate = dto.nextHearingDate ? new Date(dto.nextHearingDate) : null;

    const created = await this.prisma.case.create({
      data: {
        lawyerId,
        title: dto.title,
        caseNumber: dto.caseNumber ?? null,
        cnr: dto.cnr ?? null,
        court: dto.court ?? null,
        courtType: dto.courtType ?? null,
        jurisdiction: dto.jurisdiction ?? null,
        practiceArea: dto.practiceArea ?? null,
        description: dto.description ?? null,
        clientName: dto.clientName ?? null,
        filedAt: dto.filedAt ? new Date(dto.filedAt) : null,
        nextHearingDate,
        status: dto.status ?? CaseStatus.DRAFT,
        parties: dto.parties?.length
          ? {
              create: dto.parties.map((p) => ({
                name: p.name,
                role: p.role,
                contactEmail: p.contactEmail ?? null,
                contactPhone: p.contactPhone ?? null,
                advocateName: p.advocateName ?? null,
                isClient: p.isClient ?? false,
              })),
            }
          : undefined,
        // A case created with a hearing date gets a seeded HEARING timeline entry.
        timeline: nextHearingDate
          ? {
              create: {
                type: TimelineEventType.HEARING,
                title: 'Next hearing scheduled',
                eventDate: nextHearingDate,
              },
            }
          : undefined,
      },
    });

    return this.getDetail(lawyerId, created.id);
  }

  async getById(lawyerIdRaw: string | null | undefined, id: string): Promise<CaseDetailView> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);
    await this.findOwnedCaseOrThrow(id, lawyerId);
    return this.getDetail(lawyerId, id);
  }

  async update(lawyerIdRaw: string | null | undefined, id: string, dto: UpdateCaseDto): Promise<CaseDetailView> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);
    const existing = await this.findOwnedCaseOrThrow(id, lawyerId);

    const data: Prisma.CaseUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.caseNumber !== undefined) data.caseNumber = dto.caseNumber ?? null;
    if (dto.cnr !== undefined) data.cnr = dto.cnr ?? null;
    if (dto.court !== undefined) data.court = dto.court ?? null;
    if (dto.courtType !== undefined) data.courtType = dto.courtType ?? null;
    if (dto.jurisdiction !== undefined) data.jurisdiction = dto.jurisdiction ?? null;
    if (dto.practiceArea !== undefined) data.practiceArea = dto.practiceArea ?? null;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.clientName !== undefined) data.clientName = dto.clientName ?? null;
    if (dto.filedAt !== undefined) data.filedAt = dto.filedAt ? new Date(dto.filedAt) : null;

    const hearingChanged =
      dto.nextHearingDate !== undefined &&
      (dto.nextHearingDate ? new Date(dto.nextHearingDate).getTime() : null) !==
        (existing.nextHearingDate ? existing.nextHearingDate.getTime() : null);
    const newHearing = dto.nextHearingDate ? new Date(dto.nextHearingDate) : null;
    if (dto.nextHearingDate !== undefined) {
      data.nextHearingDate = newHearing;
    }

    const statusChanged = dto.status !== undefined && dto.status !== existing.status;
    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    // Assemble timeline side-effects from the edit.
    const timelineCreates: Prisma.CaseTimelineCreateWithoutCaseInput[] = [];
    if (statusChanged) {
      timelineCreates.push({
        type: TimelineEventType.STATUS_CHANGE,
        title: `Status changed to ${dto.status}`,
        description: `From ${existing.status} to ${dto.status}`,
        eventDate: new Date(),
      });
    }
    if (hearingChanged && newHearing) {
      timelineCreates.push({
        type: TimelineEventType.HEARING,
        title: 'Next hearing rescheduled',
        eventDate: newHearing,
      });
    }
    if (timelineCreates.length > 0) {
      data.timeline = { create: timelineCreates };
    }

    await this.prisma.case.update({ where: { id }, data });
    return this.getDetail(lawyerId, id);
  }

  // Cases are never hard-deleted. Status transitions (DISPOSED / DRAFT / etc.)
  // go through update() above, which records a STATUS_CHANGE timeline entry.

  // ---------------------------------------------------------------------------
  // Parties
  // ---------------------------------------------------------------------------

  async addParty(
    lawyerIdRaw: string | null | undefined,
    caseId: string,
    dto: CreatePartyDto,
  ): Promise<CasePartyView> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);
    await this.findOwnedCaseOrThrow(caseId, lawyerId);

    const party = await this.prisma.caseParty.create({
      data: {
        caseId,
        name: dto.name,
        role: dto.role,
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
        advocateName: dto.advocateName ?? null,
        isClient: dto.isClient ?? false,
      },
    });
    // Touch the parent so list ordering (updatedAt desc) reflects the change.
    await this.prisma.case.update({ where: { id: caseId }, data: {} });
    return this.toParty(party);
  }

  async removeParty(
    lawyerIdRaw: string | null | undefined,
    caseId: string,
    partyId: string,
  ): Promise<void> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);
    await this.findOwnedCaseOrThrow(caseId, lawyerId);

    const party = await this.prisma.caseParty.findFirst({ where: { id: partyId, caseId } });
    if (!party) {
      throw new NotFoundException('Party not found');
    }
    await this.prisma.caseParty.delete({ where: { id: partyId } });
    await this.prisma.case.update({ where: { id: caseId }, data: {} });
  }

  // ---------------------------------------------------------------------------
  // Timeline
  // ---------------------------------------------------------------------------

  async addTimeline(
    lawyerIdRaw: string | null | undefined,
    caseId: string,
    dto: CreateTimelineDto,
  ): Promise<TimelineEventView> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);
    await this.findOwnedCaseOrThrow(caseId, lawyerId);

    const event = await this.prisma.caseTimeline.create({
      data: {
        caseId,
        type: dto.type,
        title: dto.title,
        description: dto.description ?? null,
        eventDate: new Date(dto.eventDate),
      },
    });
    await this.prisma.case.update({ where: { id: caseId }, data: {} });
    return this.toTimeline(event);
  }

  async removeTimeline(
    lawyerIdRaw: string | null | undefined,
    caseId: string,
    eventId: string,
  ): Promise<void> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);
    await this.findOwnedCaseOrThrow(caseId, lawyerId);

    const event = await this.prisma.caseTimeline.findFirst({ where: { id: eventId, caseId } });
    if (!event) {
      throw new NotFoundException('Timeline event not found');
    }
    await this.prisma.caseTimeline.delete({ where: { id: eventId } });
    await this.prisma.case.update({ where: { id: caseId }, data: {} });
  }

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------

  async addNote(
    lawyerIdRaw: string | null | undefined,
    userId: string,
    caseId: string,
    dto: CreateNoteDto,
  ): Promise<CaseNoteView> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);
    await this.findOwnedCaseOrThrow(caseId, lawyerId);

    const note = await this.prisma.caseNote.create({
      data: {
        caseId,
        authorId: userId,
        body: dto.body,
      },
      include: { author: { select: { fullName: true } } },
    });
    await this.prisma.case.update({ where: { id: caseId }, data: {} });
    return this.toNote(note);
  }

  async removeNote(
    lawyerIdRaw: string | null | undefined,
    caseId: string,
    noteId: string,
  ): Promise<void> {
    const lawyerId = this.requireLawyer(lawyerIdRaw);
    await this.findOwnedCaseOrThrow(caseId, lawyerId);

    const note = await this.prisma.caseNote.findFirst({ where: { id: noteId, caseId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    await this.prisma.caseNote.delete({ where: { id: noteId } });
    await this.prisma.case.update({ where: { id: caseId }, data: {} });
  }

  // ---------------------------------------------------------------------------
  // Detail loader + mappers
  // ---------------------------------------------------------------------------

  private async getDetail(lawyerId: string, id: string): Promise<CaseDetailView> {
    const row = (await this.prisma.case.findFirst({
      where: { id, lawyerId },
      include: {
        parties: { orderBy: { createdAt: 'asc' } },
        timeline: { orderBy: { eventDate: 'asc' } },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { fullName: true } } },
        },
        _count: { select: { parties: true, documents: true } },
      },
    })) as CaseWithRelations | null;

    if (!row) {
      throw new NotFoundException('Case not found');
    }
    return this.toDetail(row);
  }

  private clientNameOf(row: { clientName: string | null }, parties: CaseParty[]): string | null {
    if (row.clientName) return row.clientName;
    const client = parties.find((p) => p.isClient);
    return client?.name ?? null;
  }

  private toSummary(
    row: Case,
    count: { parties: number; documents: number },
    clientNameFallback: string | null,
  ): CaseSummaryView {
    return {
      id: row.id,
      title: row.title,
      caseNumber: row.caseNumber,
      cnr: row.cnr,
      court: row.court,
      courtType: row.courtType,
      practiceArea: row.practiceArea,
      status: row.status,
      nextHearingDate: row.nextHearingDate ? row.nextHearingDate.toISOString() : null,
      clientName: row.clientName ?? clientNameFallback,
      partyCount: count.parties,
      documentCount: count.documents,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: CaseWithRelations): CaseDetailView {
    return {
      id: row.id,
      title: row.title,
      caseNumber: row.caseNumber,
      cnr: row.cnr,
      court: row.court,
      courtType: row.courtType,
      practiceArea: row.practiceArea,
      status: row.status,
      nextHearingDate: row.nextHearingDate ? row.nextHearingDate.toISOString() : null,
      clientName: this.clientNameOf(row, row.parties),
      partyCount: row._count.parties,
      documentCount: row._count.documents,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      description: row.description,
      jurisdiction: row.jurisdiction,
      filedAt: row.filedAt ? row.filedAt.toISOString() : null,
      parties: row.parties.map((p) => this.toParty(p)),
      timeline: row.timeline.map((t) => this.toTimeline(t)),
      notes: row.notes.map((n) => this.toNote(n)),
    };
  }

  private toParty(p: CaseParty): CasePartyView {
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      advocateName: p.advocateName,
      isClient: p.isClient,
    };
  }

  private toTimeline(t: CaseTimeline): TimelineEventView {
    return {
      id: t.id,
      type: t.type,
      title: t.title,
      description: t.description,
      eventDate: t.eventDate.toISOString(),
      createdAt: t.createdAt.toISOString(),
    };
  }

  private toNote(n: CaseNote & { author: Pick<User, 'fullName'> | null }): CaseNoteView {
    return {
      id: n.id,
      body: n.body,
      authorId: n.authorId,
      authorName: n.author?.fullName ?? null,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
  }
}
