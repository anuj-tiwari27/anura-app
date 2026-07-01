import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Case } from '@prisma/client';
import type { CaseSummaryView, DashboardSummary } from '@anura/shared';

import { PrismaService } from '../../prisma/prisma.service';

/** Cases pulled for the "recent cases" panel, with their party/document counts. */
type CaseWithCounts = Case & {
  _count: { parties: number; documents: number };
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds the dashboard summary for the current lawyer.
   * If onboarding is incomplete (no lawyerId), returns zeroed stats + empty arrays
   * rather than throwing, so the dashboard renders cleanly for new users.
   */
  async getSummary(lawyerId: string | null | undefined, userId: string): Promise<DashboardSummary> {
    if (!lawyerId) {
      return this.emptySummary();
    }

    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      activeCases,
      hearingsThisWeek,
      pendingDocuments,
      outstanding,
      unreadNotifications,
      upcomingHearingRows,
      recentCases,
    ] = await Promise.all([
      // stats.activeCases
      this.prisma.case.count({
        where: { lawyerId, status: 'ACTIVE' },
      }),

      // stats.hearingsThisWeek — HEARING timeline events on this lawyer's cases,
      // due within the next 7 days (from now).
      this.prisma.caseTimeline.count({
        where: {
          type: 'HEARING',
          eventDate: { gte: now, lte: weekAhead },
          case: { lawyerId },
        },
      }),

      // stats.pendingDocuments — documents not yet fully indexed.
      this.prisma.document.count({
        where: { lawyerId, status: { not: 'INDEXED' } },
      }),

      // stats.outstandingInvoiceAmount — sum of totals for SENT/OVERDUE invoices.
      this.prisma.invoice.aggregate({
        where: { lawyerId, status: { in: ['SENT', 'OVERDUE'] } },
        _sum: { total: true },
      }),

      // stats.unreadNotifications — scoped to the user, not the lawyer.
      this.prisma.notification.count({
        where: { userId, read: false },
      }),

      // upcomingHearings — up to 5 nearest future HEARING events.
      this.prisma.caseTimeline.findMany({
        where: {
          type: 'HEARING',
          eventDate: { gte: now },
          case: { lawyerId },
        },
        orderBy: { eventDate: 'asc' },
        take: 5,
        include: {
          case: { select: { id: true, title: true, court: true } },
        },
      }),

      // recentCases — 5 most recently updated cases with counts.
      this.prisma.case.findMany({
        where: { lawyerId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          _count: { select: { parties: true, documents: true } },
        },
      }),
    ]);

    return {
      stats: {
        activeCases,
        hearingsThisWeek,
        pendingDocuments,
        outstandingInvoiceAmount: this.decimalToNumber(outstanding._sum.total),
        unreadNotifications,
      },
      upcomingHearings: upcomingHearingRows.map((row) => ({
        caseId: row.case.id,
        caseTitle: row.case.title,
        court: row.case.court,
        eventDate: row.eventDate.toISOString(),
      })),
      recentCases: recentCases.map((c) => this.toCaseSummary(c)),
    };
  }

  /** Zeroed summary for users who have not completed onboarding. */
  private emptySummary(): DashboardSummary {
    return {
      stats: {
        activeCases: 0,
        hearingsThisWeek: 0,
        pendingDocuments: 0,
        outstandingInvoiceAmount: 0,
        unreadNotifications: 0,
      },
      upcomingHearings: [],
      recentCases: [],
    };
  }

  /** Maps a Prisma Case (+ counts) to the shared CaseSummaryView. */
  private toCaseSummary(c: CaseWithCounts): CaseSummaryView {
    return {
      id: c.id,
      title: c.title,
      caseNumber: c.caseNumber,
      cnr: c.cnr,
      court: c.court,
      courtType: c.courtType,
      practiceArea: c.practiceArea,
      status: c.status,
      nextHearingDate: c.nextHearingDate ? c.nextHearingDate.toISOString() : null,
      clientName: c.clientName,
      partyCount: c._count.parties,
      documentCount: c._count.documents,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  /** Prisma.Decimal | null -> Number (0 when absent). */
  private decimalToNumber(value: Prisma.Decimal | null): number {
    return value ? value.toNumber() : 0;
  }
}
