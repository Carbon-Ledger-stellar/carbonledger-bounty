import { Module } from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { BountiesController } from './bounties.controller';
import { PricingService } from './pricing.service';
import { DependencyService } from './dependency.service';
import { BudgetModule } from '../budget/budget.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [BudgetModule],
  controllers: [BountiesController],
  providers: [BountiesService, PricingService, DependencyService, PrismaService],
  exports: [BountiesService, PricingService, DependencyService],
})
export class BountiesModule {}
