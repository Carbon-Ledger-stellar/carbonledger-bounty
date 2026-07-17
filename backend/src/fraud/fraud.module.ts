import { Module } from '@nestjs/common';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudController } from './fraud.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FraudController],
  providers: [FraudDetectionService, PrismaService],
  exports: [FraudDetectionService],
})
export class FraudModule {}
