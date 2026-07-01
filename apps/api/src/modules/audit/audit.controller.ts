import { Controller, Get, Query } from '@nestjs/common';
import type { Paginated } from '@anura/shared';
import { UserRole } from '@anura/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService, type AuditRowView } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /audit — audit trail for the current user. ADMINs see every actor's
   * rows; everyone else is scoped to their own actions.
   */
  @Get()
  list(
    @CurrentUser('sub') actorId: string,
    @CurrentUser('role') role: UserRole,
    @Query() query: QueryAuditDto,
  ): Promise<Paginated<AuditRowView>> {
    return this.auditService.list(role, actorId, query);
  }
}
