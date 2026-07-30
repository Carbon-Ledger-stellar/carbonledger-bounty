import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';

// ── Period helpers ──────────────────────────────────────────────────────────

/** Acceptable period format: "YYYY-Q[1-4]", e.g. "2026-Q1" */
const PERIOD_REGEX = /^\d{4}-Q[1-4]$/;

// ── Request DTOs ────────────────────────────────────────────────────────────

/** Create or upsert a quarterly budget for a project. */
export class CreateBudgetDto {
  /** Logical project identifier, e.g. "backend", "frontend", "contracts" */
  @IsString()
  projectId: string;

  /** Quarter period in the format YYYY-Q[1-4], e.g. "2026-Q2" */
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'period must be in format YYYY-Q[1-4], e.g. "2026-Q2"' })
  period: string;

  /** Total allocated budget in USD */
  @IsNumber()
  @IsPositive()
  amount: number;
}

/** Request a budget override to exceed the hard cap by up to 20%. */
export class BudgetOverrideDto {
  /** The budget record ID to override */
  @IsString()
  budgetId: string;

  /** Approving maintainer / admin identifier (public key or username) */
  @IsString()
  approvedBy: string;

  /** Additional USD being approved on top of the base allocation */
  @IsNumber()
  @IsPositive()
  amountApproved: number;

  /** Documented business justification — required for audit trail */
  @IsString()
  reason: string;

  /** Optional bounty ID this override is unlocking */
  @IsOptional()
  @IsString()
  bountyId?: string;
}

/** Query params for the dashboard endpoint. */
export class BudgetDashboardQueryDto {
  /** Filter by project, e.g. "backend" */
  @IsOptional()
  @IsString()
  projectId?: string;

  /** Filter by quarter, e.g. "2026-Q2" */
  @IsOptional()
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'period must be in format YYYY-Q[1-4]' })
  period?: string;
}

/** Payload passed internally when a bounty is about to be created. */
export class BudgetCheckDto {
  /** The project area this bounty should draw from */
  projectId: string;

  /** Quarter period this bounty belongs to */
  period: string;

  /** USD reward the bounty will consume */
  rewardUsd: number;
}

// ── Response shapes ─────────────────────────────────────────────────────────

export interface BudgetUtilizationItem {
  id: string;
  projectId: string;
  period: string;
  amount: number;
  spent: number;
  remaining: number;
  /** Effective cap = amount + sum of active overrides */
  effectiveCap: number;
  utilizationPct: number;
  status: 'ok' | 'warning' | 'frozen';
  overrides: {
    id: string;
    approvedBy: string;
    amountApproved: number;
    reason: string;
    bountyId?: string;
    createdAt: Date;
  }[];
  recentAlerts: {
    id: string;
    alertType: string;
    utilization: number;
    message: string;
    createdAt: Date;
  }[];
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  utilizationPct: number;
  /** Warning threshold breached even if allowed */
  warning: boolean;
  budget: {
    id: string;
    projectId: string;
    period: string;
    amount: number;
    spent: number;
    effectiveCap: number;
  };
}
