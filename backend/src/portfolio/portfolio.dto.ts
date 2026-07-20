import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export type PipelineStage =
  | 'applied'
  | 'claimed'
  | 'in-progress'
  | 'submitted'
  | 'under-review'
  | 'completed';

export const PIPELINE_STAGES: PipelineStage[] = [
  'applied',
  'claimed',
  'in-progress',
  'submitted',
  'under-review',
  'completed',
];

export class ContributorProfileDto {
  @IsString()
  contributorId: string;

  @IsArray()
  @IsString({ each: true })
  skills: string[];

  @IsOptional()
  @IsString()
  walletAddress?: string;
}

export class PortfolioSummaryDto {
  contributorId: string;
  activeBounties: number;
  completedBounties: number;
  totalEarnings: number;
  rating: number;
  pipelineByStage: Record<PipelineStage, number>;
}

export class MilestoneDto {
  id: string;
  bountyId: string;
  bountyTitle: string;
  earningsUsd: number;
  completedAt: string;
  skills: string[];
}

export class SkillGrowthDto {
  skill: string;
  acquiredAt: string;
}

export class EarningsProjectionDto {
  annualEstimate: number;
  monthlyAverage: number;
  basedOnMonths: number;
  disclaimer: string;
}

export class AddToPipelineDto {
  @IsString()
  bountyId: string;

  @IsString()
  stage: PipelineStage;
}

export class MovePipelineDto {
  @IsString()
  bountyId: string;

  @IsString()
  newStage: PipelineStage;
}

export class CompleteBountyDto {
  @IsString()
  bountyId: string;

  earningsUsd: number;

  @IsArray()
  @IsString({ each: true })
  skills: string[];
}
