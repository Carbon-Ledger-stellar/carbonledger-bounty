import { Module } from '@nestjs/common';
import { RetirementsService } from './retirements.service';
import { RetirementsController } from './retirements.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [RetirementsController],
  providers: [RetirementsService, PrismaService],
  exports: [RetirementsService],
})
export class RetirementsModule {}
