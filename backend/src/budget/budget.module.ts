import { Module } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [BudgetService, PrismaService],
  controllers: [BudgetController],
  exports: [BudgetService], // export so BountiesService can inject it
})
export class BudgetModule {}
