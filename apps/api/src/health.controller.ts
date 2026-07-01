import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health(): { status: string; service: string; time: string } {
    return { status: 'ok', service: 'anura-api', time: new Date().toISOString() };
  }
}
