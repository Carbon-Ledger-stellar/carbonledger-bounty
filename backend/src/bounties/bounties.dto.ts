import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type BountyStatus = 'open' | 'in_progress' | 'closed' | 'cancelled';
export type SortField = 'reward' | 'deadline' | 'difficulty' | 'applications';

const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];

export class CreateBountyDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsArray()
  @IsString({ each: true })
  requirements: string[];

  @IsArray()
  @IsString({ each: true })
  acceptanceCriteria: string[];

  @IsNumber()
  @Min(0)
  rewardUsd: number;

  @IsEnum(DIFFICULTIES)
  difficulty: Difficulty;

  /** ISO 8601 deadline */
  @IsISO8601()
  deadline: string;

  @IsString()
  bountyType: string;

  @IsString()
  reviewerAddress: string;

  @IsOptional()
  @IsString()
  reviewerGithub?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** Internal bounties are hidden from public marketplace */
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class FeatureBountyDto {
  @IsString()
  bountyId: string;

  /** true = feature, false = unfeature */
  @IsBoolean()
  featured: boolean;
}

export class BountyListQueryDto {
  sort?: SortField;
  order?: 'asc' | 'desc';
  difficulty?: Difficulty;
  minReward?: number;
  maxReward?: number;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class OverridePriceDto {
  @IsString()
  bountyId: string;

  /** Admin-set price; must fall within +/-30% of the current computed price. */
  @IsNumber()
  @Min(0)
  price: number;
}
