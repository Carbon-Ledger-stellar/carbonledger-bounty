import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

// ── Registration / onboarding ──────────────────────────────────────────────

/**
 * Called when a contributor first joins the platform (optionally with a ref
 * code they clicked in an invite link, e.g. /join?ref=ABC123).
 */
export class RegisterContributorDto {
  /** User.id of the new contributor */
  @IsString()
  @IsNotEmpty()
  userId: string;

  /**
   * Referral code from the URL parameter (?ref=<code>).
   * Absent for organic sign-ups.
   */
  @IsOptional()
  @IsString()
  referralCode?: string;
}

// ── Bounty completion (triggers bonus calculation) ─────────────────────────

/**
 * Emitted by the bounty completion flow once a payout is confirmed.
 * The referral service will compute and record any owed bonus.
 */
export class BountyCompletedDto {
  /** Contributor.id of the person who completed the bounty */
  @IsString()
  @IsNotEmpty()
  contributorId: string;

  /** Internal bounty identifier */
  @IsString()
  @IsNotEmpty()
  bountyId: string;

  /** USD value of the bounty reward */
  @IsNumber()
  @IsPositive()
  bountyAmountUsd: number;
}

// ── Query params ───────────────────────────────────────────────────────────

export class ReferralStatsQueryDto {
  /** Contributor.id whose stats to fetch */
  @IsString()
  @IsNotEmpty()
  contributorId: string;
}

export class CohortQueryDto {
  /**
   * ISO 8601 date string – include cohorts starting on/after this date.
   * Defaults to 90 days ago if omitted.
   */
  @IsOptional()
  @IsString()
  since?: string;

  /** Pagination */
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class TopReferrersQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
