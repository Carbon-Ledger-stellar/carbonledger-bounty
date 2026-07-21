import { Module } from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { BountiesController } from './bounties.controller';
import { PricingService } from './pricing.service';
import { BudgetModule } from '../budget/budget.module';

@Module({
  imports: [BudgetModule],
  controllers: [BountiesController],
  providers: [BountiesService, PricingService],
  exports: [BountiesService, PricingService],
})
export class BountiesModule {}
