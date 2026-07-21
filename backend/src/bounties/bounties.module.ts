import { Module } from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { BountiesController } from './bounties.controller';
import { PricingService } from './pricing.service';
import { DependencyService } from './dependency.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BountiesController],
  providers: [BountiesService, PricingService, DependencyService, PrismaService],
  exports: [BountiesService, PricingService, DependencyService],
})
export class BountiesModule {}
