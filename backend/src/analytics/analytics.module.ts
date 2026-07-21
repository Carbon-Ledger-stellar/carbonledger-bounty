import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsScheduler } from './analytics.scheduler';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsScheduler, PrismaService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
