import { Module } from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { BountiesController } from './bounties.controller';

@Module({
  controllers: [BountiesController],
  providers: [BountiesService],
  exports: [BountiesService],
})
export class BountiesModule {}
