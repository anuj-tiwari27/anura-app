import { Controller, Get } from '@nestjs/common';
import type { DashboardSummary } from '@anura/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** GET /dashboard/summary -> aggregated stats + upcoming hearings + recent cases. */
  @Get('summary')
  getSummary(
    @CurrentUser('lawyerId') lawyerId: string | null | undefined,
    @CurrentUser('sub') userId: string,
  ): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(lawyerId, userId);
  }
}
