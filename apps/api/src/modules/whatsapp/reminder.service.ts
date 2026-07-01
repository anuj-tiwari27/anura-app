import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Case, CaseParty } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from '../../integrations/messaging/whatsapp.service';

type CaseWithParties = Case & { parties: CaseParty[] };

/**
 * Builds and dispatches WhatsApp hearing reminders.
 *
 * - `sendReminderForCase` is the single unit of work: resolve the client phone,
 *   send a WhatsApp text, and create an in-app HEARING_REMINDER notification
 *   (deduped by link). Reused by the manual test endpoint and the cron sweep.
 * - `sweepUpcomingHearings` runs hourly and reminds about hearings due in the
 *   next ~48h across every lawyer. Everything is wrapped defensively so a down
 *   WhatsApp/Redis/DB dependency never crashes the app.
 */
@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  /** Look-ahead window for the cron sweep. */
  private static readonly WINDOW_HOURS = 48;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * Send a hearing reminder for a single case. Returns the WhatsApp send result
   * plus whether an in-app notification was created. Throwing is left to the
   * caller's discretion via `throwOnMissing` (the test endpoint wants a 400/404,
   * the cron sweep wants to keep going).
   */
  async sendReminderForCase(
    caseRow: CaseWithParties,
    opts: { userId?: string | null; createNotification?: boolean } = {},
  ): Promise<{ ok: boolean; phone: string; notified: boolean }> {
    const phone = this.resolveClientPhone(caseRow);
    const message = this.buildMessage(caseRow);

    let ok = false;
    try {
      const res = await this.whatsapp.sendText(phone, message);
      ok = res.ok;
    } catch (err) {
      this.logger.error(`WhatsApp send failed for case ${caseRow.id}`, err as Error);
    }

    let notified = false;
    if (opts.createNotification && opts.userId) {
      notified = await this.createReminderNotification(caseRow, opts.userId);
    }

    return { ok, phone, notified };
  }

  /**
   * Hourly sweep: find cases whose nextHearingDate falls inside the look-ahead
   * window and fire a reminder for each. Fully defensive — logs and continues on
   * any per-case failure, never throws.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepUpcomingHearings(): Promise<void> {
    const now = new Date();
    const until = new Date(now.getTime() + ReminderService.WINDOW_HOURS * 60 * 60 * 1000);

    let cases: Array<CaseWithParties & { lawyer: { userId: string } }>;
    try {
      cases = await this.prisma.case.findMany({
        where: {
          nextHearingDate: { gte: now, lte: until },
          status: { notIn: ['DISPOSED', 'ARCHIVED'] },
        },
        include: {
          parties: true,
          lawyer: { select: { userId: true } },
        },
      });
    } catch (err) {
      this.logger.error('Hearing-reminder sweep: failed to load cases', err as Error);
      return;
    }

    if (!cases.length) {
      this.logger.debug('Hearing-reminder sweep: no upcoming hearings');
      return;
    }

    let sent = 0;
    for (const caseRow of cases) {
      try {
        const alreadyNotified = await this.hasRecentReminderNotification(caseRow);
        if (alreadyNotified) continue;

        const result = await this.sendReminderForCase(caseRow, {
          userId: caseRow.lawyer.userId,
          createNotification: true,
        });
        if (result.notified || result.ok) sent += 1;
      } catch (err) {
        this.logger.error(`Hearing-reminder sweep: case ${caseRow.id} failed`, err as Error);
      }
    }

    this.logger.log(`Hearing-reminder sweep: processed ${cases.length} case(s), reminded ${sent}`);
  }

  /** Prefer the client party's phone, then any party phone, then a demo fallback. */
  private resolveClientPhone(caseRow: CaseWithParties): string {
    const parties = caseRow.parties ?? [];
    const client = parties.find((p) => p.isClient && p.contactPhone);
    if (client?.contactPhone) return client.contactPhone;

    const anyWithPhone = parties.find((p) => p.contactPhone);
    if (anyWithPhone?.contactPhone) return anyWithPhone.contactPhone;

    return 'demo';
  }

  private buildMessage(caseRow: CaseWithParties): string {
    const title = caseRow.title || caseRow.caseNumber || 'your case';
    const when = caseRow.nextHearingDate
      ? new Date(caseRow.nextHearingDate).toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata',
        })
      : 'soon';
    const court = caseRow.court ? ` at ${caseRow.court}` : '';
    const client = caseRow.clientName ? `Hello ${caseRow.clientName}, ` : '';
    return `${client}reminder: the next hearing for "${title}"${court} is scheduled for ${when}. - Anura`;
  }

  /** Stable link used both to create and to dedupe the reminder notification. */
  private reminderLink(caseRow: CaseWithParties): string {
    const stamp = caseRow.nextHearingDate
      ? new Date(caseRow.nextHearingDate).toISOString()
      : 'unscheduled';
    return `/cases/${caseRow.id}?reminder=${stamp}`;
  }

  /**
   * Create an in-app HEARING_REMINDER notification for the lawyer's user, unless
   * one with the same link already exists. Returns true when a row was created.
   */
  private async createReminderNotification(caseRow: CaseWithParties, userId: string): Promise<boolean> {
    const link = this.reminderLink(caseRow);
    try {
      const existing = await this.prisma.notification.findFirst({
        where: { userId, type: 'HEARING_REMINDER', link },
        select: { id: true },
      });
      if (existing) return false;

      await this.prisma.notification.create({
        data: {
          userId,
          type: 'HEARING_REMINDER',
          channel: 'WHATSAPP',
          title: 'Upcoming hearing',
          body: this.buildMessage(caseRow),
          link,
          meta: {
            caseId: caseRow.id,
            nextHearingDate: caseRow.nextHearingDate
              ? new Date(caseRow.nextHearingDate).toISOString()
              : null,
          },
        },
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to create reminder notification for case ${caseRow.id}`, err as Error);
      return false;
    }
  }

  /**
   * Dedup guard for the sweep: has a reminder for this exact hearing already been
   * recorded for the lawyer's user? Matches the same link used on creation.
   */
  private async hasRecentReminderNotification(
    caseRow: CaseWithParties & { lawyer: { userId: string } },
  ): Promise<boolean> {
    try {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: caseRow.lawyer.userId,
          type: 'HEARING_REMINDER',
          link: this.reminderLink(caseRow),
        },
        select: { id: true },
      });
      return !!existing;
    } catch (err) {
      this.logger.error(`Dedup check failed for case ${caseRow.id}`, err as Error);
      // On failure, err on the side of not spamming: treat as already-notified.
      return true;
    }
  }
}
