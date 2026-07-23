import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

// ── Value types ──────────────────────────────────────────────────────────────

export type ReopenReason =
  | 'initial-rejected'
  | 'additional-scope'
  | 'bug-fixes'
  | 'new-requirements';

export const REOPEN_REASONS: ReopenReason[] = [
  'initial-rejected',
  'additional-scope',
  'bug-fixes',
  'new-requirements',
];

export type BountyVersionStatus = 'open' | 'in_progress' | 'completed' | 'closed';

export const BOUNTY_VERSION_STATUSES: BountyVersionStatus[] = [
  'open',
  'in_progress',
  'completed',
  'closed',
];

// ── Request DTOs ─────────────────────────────────────────────────────────────

/** Create the initial (v1) version for a bounty. */
export class InitBountyVersionDto {
  @IsNumber()
  @Min(0)
  budgetUsd: number;
}

/**
 * Re-open a closed bounty as a new version.
 * `milestoneIds` supports partial re-opening — omit or leave empty to re-open the full scope.
 */
export class ReopenBountyDto {
  @IsIn(REOPEN_REASONS)
  reason: ReopenReason;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  milestoneIds?: string[];

  @IsNumber()
  @Min(0)
  budgetUsd: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  notes?: string;
}

/** Update the status of the current version (e.g. open → in_progress → completed → closed). */
export class UpdateVersionStatusDto {
  @IsIn(BOUNTY_VERSION_STATUSES)
  status: BountyVersionStatus;
}

// ── Response shapes ──────────────────────────────────────────────────────────

export interface BountyVersion {
  id: string;
  bountyId: string;
  versionNumber: number;
  status: BountyVersionStatus;
  /** Budget tracked separately per version. */
  budgetUsd: number;
  /** Milestones in scope for this version; empty = full scope. */
  milestoneIds: string[];
  /** Why this version was opened; absent for v1. */
  reopenReason?: ReopenReason;
  reopenedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export type AuditAction = 'version_created' | 'reopened' | 'status_changed';

export interface AuditEntry {
  id: string;
  bountyId: string;
  versionNumber: number;
  action: AuditAction;
  actorId: string;
  reason?: ReopenReason;
  notes?: string;
  createdAt: Date;
}
