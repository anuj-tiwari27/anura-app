import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from '../../integrations/messaging/whatsapp.service';
import { ReminderService } from './reminder.service';
import { ReminderTestDto } from './dto/reminder-test.dto';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly reminders: ReminderService,
  ) {}

  /**
   * Meta WhatsApp Cloud API webhook verification (GET). Meta calls this with
   * hub.mode=subscribe, hub.verify_token, hub.challenge. Echo the challenge back
   * (as a bare string body) when the token matches, otherwise 403.
   */
  @Public()
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    if (mode === 'subscribe' && verifyToken === this.whatsapp.verifyToken) {
      this.logger.log('WhatsApp webhook verified');
      return challenge ?? '';
    }
    this.logger.warn('WhatsApp webhook verification failed');
    throw new ForbiddenException('Verification failed');
  }

  /**
   * Inbound event webhook (POST). We simply acknowledge and log the payload;
   * Meta expects a fast 200 so it does not retry.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  receiveWebhook(@Body() payload: unknown): { received: true } {
    this.logger.log(`WhatsApp inbound event: ${JSON.stringify(payload)}`);
    return { received: true };
  }

  /**
   * Manually trigger a hearing reminder for one of the caller's cases. Scoped to
   * the current lawyer; sends a WhatsApp text about the case's next hearing.
   */
  @Post('reminders/test')
  async sendTestReminder(
    @CurrentUser('sub') userId: string,
    @CurrentUser('lawyerId') lawyerId: string | null | undefined,
    @Body() dto: ReminderTestDto,
  ): Promise<{ ok: boolean }> {
    if (!lawyerId) {
      throw new BadRequestException('Complete onboarding first');
    }

    const caseRow = await this.prisma.case.findFirst({
      where: { id: dto.caseId, lawyerId },
      include: { parties: true },
    });
    if (!caseRow) {
      throw new NotFoundException('Case not found');
    }

    const result = await this.reminders.sendReminderForCase(caseRow, {
      userId,
      createNotification: true,
    });

    return { ok: result.ok };
  }
}
