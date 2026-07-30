import { Module } from '@nestjs/common';
import { BountyVersioningService } from './versioning.service';
import { BountyVersioningController } from './versioning.controller';

@Module({
  controllers: [BountyVersioningController],
  providers: [BountyVersioningService],
  exports: [BountyVersioningService],
})
export class BountyVersioningModule {}
