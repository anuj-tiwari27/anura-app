import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type AuditLog } from '@prisma/client';
import type { AuditLogView, Paginated } from '@anura/shared';
import { UserRole } from '@anura/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { paginated, skipTake } from '../../common/dto/pagination.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

/** Params for recording an audit entry from any feature module. */
export interface LogAuditParams {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an audit entry. Auditing must never break the calling operation,
   * so all failures are swallowed and logged rather than propagated.
   */
  async log(params: LogAuditParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId ?? null,
          action: params.action,
          entityType: params.entityType ?? null,
          entityId: params.entityId ?? null,
          meta:
            params.meta === undefined || params.meta === null
              ? Prisma.JsonNull
              : params.meta,
          ip: params.ip ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log (action=${params.action})`,
        err as Error,
      );
    }
  }

  /**
   * Lists audit rows. Non-admin callers only see their own actions; ADMINs may
   * list everything. Filters by entityType/entityId and paginates.
   */
  async list(
    role: UserRole,
    actorId: string,
    query: QueryAuditDto,
  ): Promise<Paginated<AuditLogView>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AuditLogWhereInput = {};
    if (role !== UserRole.ADMIN) {
      where.actorId = actorId;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...skipTake(page, pageSize),
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginated(rows.map(toAuditLogView), total, page, pageSize);
  }
}

/** Maps a Prisma AuditLog row to the shared API view shape. */
function toAuditLogView(row: AuditLog): AuditLogView {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    meta: (row.meta ?? null) as Record<string, unknown> | null,
    createdAt: row.createdAt.toISOString(),
  };
}
