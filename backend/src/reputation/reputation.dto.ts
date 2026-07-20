import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsISO8601,
  IsEnum,
} from 'class-validator';

// ── Input DTOs ───────────────────────────────────────────────────────────────

/**
 * Payload sent after a bounty is completed to update the contributor's
 * multi-dimensional reputation scores.
 */
export class RecordBountyCompletionDto {
  /** Stellar wallet address of the contributor. */
  @IsString()
  walletAddress: string;

  /** Bounty identifier for audit trail linkage. */
  @IsString()
  bountyId: string;

  /**
   * Reviewer's code-quality score on a 1–5 scale (integer or half-point).
   * Maps to codeQualityScore weight (40%).
   */
  @IsNumber()
  @Min(1)
  @Max(5)
  reviewerScore: number;

  /**
   * ISO 8601 timestamp of when the contributor actually submitted the work.
   */
  @IsISO8601()
  submittedAt: string;

  /**
   * ISO 8601 timestamp of the original bounty deadline.
   */
  @IsISO8601()
  deadlineAt: string;

  /**
   * Average latency in hours between a reviewer posting a comment and the
   * contributor replying. Lower is better. Used for communicationScore (20%).
   */
  @IsNumber()
  @Min(0)
  avgResponseHours: number;

  /**
   * Community/peer rating on a 1–5 scale (10% weight).
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  peerRating?: number;
}

/**
 * Submit a peer rating for a contributor independent of a bounty completion.
 */
export class SubmitPeerRatingDto {
  @IsString()
  walletAddress: string;

  @IsOptional()
  @IsString()
  bountyId?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

/**
 * Upsert (or create) a contributor profile by wallet address.
 */
export class UpsertContributorDto {
  @IsString()
  walletAddress: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

// ── Query / Filter DTOs ──────────────────────────────────────────────────────

export type LeaderboardSort =
  | 'reputation'
  | 'codeQuality'
  | 'timeliness'
  | 'communication'
  | 'peerFeedback';

export class LeaderboardQueryDto {
  sort?: LeaderboardSort;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// ── Response / Shape DTOs (plain objects, no validation needed) ──────────────

export interface DimensionBreakdown {
  /** Score 0–100 */
  score: number;
  /** Weight of this dimension in the overall score (0–1) */
  weight: number;
  /** Weighted contribution to the total score */
  weightedContribution: number;
  /** Human-readable label */
  label: string;
}

export interface ReputationBreakdownResponse {
  walletAddress: string;
  displayName: string | null;
  reputationScore: number;
  tier: ReputationTier;
  dimensions: {
    codeQuality: DimensionBreakdown;
    timeliness: DimensionBreakdown;
    communication: DimensionBreakdown;
    peerFeedback: DimensionBreakdown;
  };
  stats: {
    totalBountiesCompleted: number;
    totalBountiesOnTime: number;
    totalBountiesLate: number;
    totalBountiesVeryLate: number;
    onTimeRate: number;
  };
  improvementTargets: ImprovementTarget[];
  trend: TrendDirection;
}

export interface ImprovementTarget {
  dimension: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  advice: string;
}

export type ReputationTier = 'rising' | 'established' | 'trusted' | 'elite';
export type TrendDirection = 'improving' | 'stable' | 'declining' | 'insufficient_data';
