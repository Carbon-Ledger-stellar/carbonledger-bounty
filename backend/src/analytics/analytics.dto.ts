import { IsOptional, IsEnum, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export type TrendWindow = '7d' | '30d' | '90d';
export type ReportPeriod = 'weekly' | 'monthly' | 'quarterly';

export class TrendQueryDto {
  @IsOptional()
  @IsEnum(['7d', '30d', '90d'])
  window?: TrendWindow = '30d';
}

export class ReportQueryDto {
  @IsOptional()
  @IsEnum(['weekly', 'monthly', 'quarterly'])
  period?: ReportPeriod = 'monthly';

  /**
   * ISO date string for the END of the report period.
   * Defaults to now.
   */
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

// ── Response shapes ──────────────────────────────────────────────────────────

export interface CoreMetricsDto {
  bountiesOpen: number;
  applicationsPending: number;
  avgVelocityHours: number | null;
  completionRate: number;
  avgTimeToCompleteHours: number | null;
  costPerTask: number | null;
  totalCompletions: number;
  totalPayoutsUsd: number;
  uniqueContributors: number;
  computedAt: string;
}

export interface TrendPoint {
  date: string;        // ISO date (day)
  bountiesOpen: number;
  completions: number;
  applicationsPending: number;
  avgVelocityHours: number | null;
}

export interface TrendAnalysisDto {
  window: TrendWindow;
  points: TrendPoint[];
  // Derived acceleration: positive = accelerating completions, negative = decelerating
  completionVelocityTrend: 'accelerating' | 'decelerating' | 'stable';
  completionGrowthPct: number; // % change from first half to second half of window
  previousWindowAvgCompletions: number;
  currentWindowAvgCompletions: number;
  comparison: {
    '7d': { completions: number; avgVelocity: number | null };
    '30d': { completions: number; avgVelocity: number | null };
    '90d': { completions: number; avgVelocity: number | null };
  };
}

export interface CohortRow {
  cohortMonth: string;       // e.g. "2024-01"
  contributorsInCohort: number;
  returnedFor2nd: number;    // absolute
  returnedFor2ndPct: number; // percentage
  returnedFor3rd: number;
  returnedFor3rdPct: number;
}

export interface RetentionDto {
  cohorts: CohortRow[];
  overallRetentionFor2nd: number; // across all cohorts
  overallRetentionFor3rd: number;
}

export interface DistributionBucket {
  rank: number;            // 1 = highest earner
  contributorId: string;
  totalEarnedUsd: number;
  completions: number;
  pctOfTotalPayout: number;
}

export interface PaymentDistributionDto {
  topPercentile: number;           // 20
  topPercentileEarningsPct: number; // e.g. 67.4 (top 20% earn 67.4% of funds)
  totalPayoutsUsd: number;
  totalContributors: number;
  buckets: DistributionBucket[];   // top 20 contributors
  giniCoefficient: number;         // 0=perfect equality, 1=extreme inequality
}

export interface SnapshotSummaryDto {
  snapshotAt: string;
  bountiesOpen: number;
  bountiesCompleted: number;
  applicationsPending: number;
  avgTimeToCompleteHours: number | null;
  completionRate: number | null;
  costPerTask: number | null;
  totalPayoutsUsd: number;
  uniqueContributorsEver: number;
}
