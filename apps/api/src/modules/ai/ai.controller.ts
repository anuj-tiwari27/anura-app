import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type {
  AIChatView,
  AIMessageView,
  DraftView,
} from '@anura/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiAssistantService } from './ai-assistant.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateDraftDto } from './dto/create-draft.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiAssistantService) {}

  // --- Chats ---------------------------------------------------------------

  @Get('chats')
  listChats(@CurrentUser('sub') userId: string): Promise<AIChatView[]> {
    return this.ai.listChats(userId);
  }

  @Post('chats')
  createChat(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateChatDto,
  ): Promise<AIChatView> {
    return this.ai.createChat(userId, dto);
  }

  @Get('chats/:id')
  getChat(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<AIChatView> {
    return this.ai.getChat(userId, id);
  }

  @Post('chats/:id/messages')
  sendMessage(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ): Promise<{ message: AIMessageView; reply: AIMessageView }> {
    return this.ai.sendMessage(userId, id, dto);
  }

  @Delete('chats/:id')
  @HttpCode(204)
  async deleteChat(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.ai.deleteChat(userId, id);
  }

  // --- Drafting ------------------------------------------------------------

  @Post('draft')
  createDraft(
    @CurrentUser('sub') userId: string,
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Body() dto: CreateDraftDto,
  ): Promise<DraftView> {
    return this.ai.createDraft(userId, this.requireLawyer(lawyerId), dto);
  }

  @Get('drafts')
  listDrafts(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Query('caseId') caseId?: string,
  ): Promise<DraftView[]> {
    return this.ai.listDrafts(this.requireLawyer(lawyerId), caseId);
  }

  @Get('drafts/:id')
  getDraft(
    @CurrentUser('lawyerId') lawyerId: string | null,
    @Param('id') id: string,
  ): Promise<DraftView> {
    return this.ai.getDraft(this.requireLawyer(lawyerId), id);
  }

  private requireLawyer(lawyerId: string | null | undefined): string {
    if (!lawyerId) throw new BadRequestException('Complete onboarding first');
    return lawyerId;
  }
}
