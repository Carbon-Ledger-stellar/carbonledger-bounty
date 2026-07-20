import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ArrayMinSize,
} from 'class-validator';

// ── Core domain interfaces ───────────────────────────────────────────────────

export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'expert';

const EXPERIENCE_LEVELS: ExperienceLevel[] = ['junior', 'mid', 'senior', 'expert'];

export interface ContributorProfile {
  contributorId: string;
  skills: string[];
  experienceLevel: ExperienceLevel;
  /** Number of successfully completed bounties */
  pastCompletions: number;
  /** 0-1 ratio of completed / accepted bounties */
  successRate: number;
  /** Preferred bounty types, e.g. ['smart-contracts', 'frontend'] */
  preferredTypes: string[];
}

export interface BountyMatchResult {
  bountyId: string;
  title: string;
  rewardUsd: number;
  difficulty: string;
  tags: string[];
  /** 0-100 composite match score */
  matchScore: number;
  /** Tags / skills from the bounty that the contributor already has */
  matchedSkills: string[];
  /** Tags / skills the contributor is currently missing */
  missingSkills: string[];
  /** True when 30 ≤ matchScore ≤ 70 — a "stretch" learning opportunity */
  isLearningBounty: boolean;
  /** Whether the bounty is currently open for applications */
  availability: boolean;
}

export interface LearningPath {
  /** The specific skill the contributor should aim to learn */
  targetSkill: string;
  /** Bounties in the 30-70% match range that would develop this skill */
  relatedBounties: BountyMatchResult[];
  /** Rough time estimate to gain the skill (hours) */
  estimatedHours: number;
}

export interface RecommendationResponse {
  contributorId: string;
  recommendations: BountyMatchResult[];
  learningPaths: LearningPath[];
  /** Wall-clock time taken to compute the response (milliseconds) */
  computedInMs: number;
}

// ── DTO classes (validated via class-validator) ──────────────────────────────

export class RegisterContributorDto {
  @IsString()
  contributorId: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  skills: string[];

  @IsEnum(EXPERIENCE_LEVELS)
  experienceLevel: ExperienceLevel;

  @IsNumber()
  @Min(0)
  pastCompletions: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  successRate: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredTypes?: string[];
}

export class GetRecommendationsDto {
  @IsString()
  contributorId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minScore?: number;
}
