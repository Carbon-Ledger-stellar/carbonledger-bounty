import { IsString } from 'class-validator';
import { Domain, Impact } from './bounty-taxonomy';
import { Difficulty } from '../bounties/bounties.dto';

export class SearchTaxonomyQueryDto {
  q?: string;
  domain?: Domain;
  area?: string;
  component?: string;
  taskType?: string;
  difficulty?: Difficulty;
  impact?: Impact;
  tag?: string;
  page?: number;
  limit?: number;
}

export class CategorizeBountyDto {
  @IsString()
  title: string;

  @IsString()
  description: string;
}
