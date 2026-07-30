import { Module } from '@nestjs/common';
import { ReputationService } from './reputation.service';
import { ReputationController } from './reputation.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ReputationController],
  providers: [ReputationService, PrismaService],
  exports: [ReputationService],
})
export class ReputationModule {}
