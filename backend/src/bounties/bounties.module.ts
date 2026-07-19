import { Module } from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { BountiesController } from './bounties.controller';
import { PricingService } from './pricing.service';

@Module({
  controllers: [BountiesController],
  providers: [BountiesService, PricingService],
  exports: [BountiesService, PricingService],
})
export class BountiesModule {}
