import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

@Module({
  controllers: [ReferralController],
  providers: [ReferralService, PrismaService],
  exports: [ReferralService],
})
export class ReferralModule {}
