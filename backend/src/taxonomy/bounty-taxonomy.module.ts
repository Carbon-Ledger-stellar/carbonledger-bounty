import { Module } from '@nestjs/common';
import { BountiesModule } from '../bounties/bounties.module';
import { BountyTaxonomyController } from './bounty-taxonomy.controller';
import { BountyTaxonomyService } from './bounty-taxonomy.service';

@Module({
  imports: [BountiesModule],
  controllers: [BountyTaxonomyController],
  providers: [BountyTaxonomyService],
  exports: [BountyTaxonomyService],
})
export class BountyTaxonomyModule {}
