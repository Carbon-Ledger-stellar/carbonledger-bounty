import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('api/v1/stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('platform')
  async getPlatformStats() {
    return this.statsService.getPlatformStats();
  }
}
