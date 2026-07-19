import { Module } from '@nestjs/common';
import { BountiesModule } from '../bounties/bounties.module';
import { MatchingController } from './matching.controller';
import { SkillMatcherService } from './skill-matcher.service';

@Module({
  imports: [BountiesModule],
  controllers: [MatchingController],
  providers: [SkillMatcherService],
  exports: [SkillMatcherService],
})
export class MatchingModule {}
