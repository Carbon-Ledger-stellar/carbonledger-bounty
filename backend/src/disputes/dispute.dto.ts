import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Value types ──────────────────────────────────────────────────────────────

export type DisputeStatus =
  | 'opened'
  | 'under_review'
  | 'decided'
  | 'appealed'
  | 'final';

export type EvidenceType =
  | 'pr_link'
  | 'test_result'
  | 'documentation'
  | 'comment'
  | 'other';

export type DecisionType = 'approved' | 'rejected' | 'partial';

export const DISPUTE_STATUSES: DisputeStatus[] = [
  'opened',
  'under_review',
  'decided',
  'appealed',
  'final',
];

export const EVIDENCE_TYPES: EvidenceType[] = [
  'pr_link',
  'test_result',
  'documentation',
  'comment',
  'other',
];

export const DECISION_TYPES: DecisionType[] = [
  'approved',
  'rejected',
  'partial',
];

// Basis-point constants for partial payments
export const PAYMENT_BPS: Record<DecisionType, number> = {
  approved: 10000, // 100%
  partial: 5000,   // 50%
  rejected: 0,     // 0%
};

// ── Request DTOs ─────────────────────────────────────────────────────────────

/**
 * Payload to open a new dispute.
 * Sent by the contributor whose submission was rejected.
 */
export class OpenDisputeDto {
  /** ID of the bounty being disputed */
  @IsString()
  bountyId: string;

  /** Stellar public key / user ID of the reviewer who rejected the work */
  @IsString()
  reviewerId: string;

  /** Optional: pre-assigned arbitrator (may be set later) */
  @IsOptional()
  @IsString()
  arbitratorId?: string;

  /** Initial evidence the contributor wants to attach at opening time */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddEvidenceDto)
  initialEvidence?: AddEvidenceDto[];
}

/**
 * A single piece of evidence to attach to a dispute.
 */
export class AddEvidenceDto {
  /** Type of evidence */
  @IsIn(EVIDENCE_TYPES)
  type: EvidenceType;

  /** Short human-readable title, e.g. "PR #42 - implement credit minting" */
  @IsString()
  @MinLength(3)
  title: string;

  /**
   * The actual content: a URL (for pr_link / test_result / documentation)
   * or free text (for comment / other).
   */
  @IsString()
  @MinLength(1)
  content: string;

  /** Optional JSON-encoded metadata (PR number, test suite name, etc.) */
  @IsOptional()
  @IsString()
  metadata?: string;
}

/**
 * Extend the arbitrator review window (arbitrator only).
 * Can only extend once, and only up to 14 days from dispute creation.
 */
export class ExtendReviewDto {
  /** Must be true — explicit intent to extend */
  @IsBoolean()
  extend: boolean;
}

/**
 * Arbitrator submits a binding decision.
 */
export class MakeDecisionDto {
  /** The decision outcome */
  @IsIn(DECISION_TYPES)
  decision: DecisionType;

  /**
   * Mandatory written rationale — must explain reasoning for audit trail.
   * Minimum 20 characters to prevent empty/trivial rationale.
   */
  @IsString()
  @MinLength(20)
  rationale: string;
}

/**
 * Contributor files an appeal after a 'decided' dispute.
 * Must include at least one new piece of evidence.
 */
export class FileAppealDto {
  /** Reason for the appeal */
  @IsString()
  @MinLength(20)
  appealReason: string;

  /** New evidence presented for the appeal — at least one required */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddEvidenceDto)
  newEvidence: AddEvidenceDto[];
}

/**
 * Query params for listing disputes.
 */
export class DisputeQueryDto {
  @IsOptional()
  @IsString()
  bountyId?: string;

  @IsOptional()
  @IsString()
  contributorId?: string;

  @IsOptional()
  @IsString()
  arbitratorId?: string;

  @IsOptional()
  @IsIn(DISPUTE_STATUSES)
  status?: DisputeStatus;
}

// ── Response shapes (plain interfaces — no class-transformer needed) ──────────

export interface DisputeResponse {
  disputeId: string;
  bountyId: string;
  contributorId: string;
  reviewerId: string;
  arbitratorId: string | null;
  status: string;
  reviewDeadline: Date;
  reviewExtended: boolean;
  appealCount: number;
  appealedAt: Date | null;
  appealReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  decidedAt: Date | null;
  finalizedAt: Date | null;
  evidence: EvidenceResponse[];
  decisions: DecisionResponse[];
}

export interface EvidenceResponse {
  evidenceId: string;
  disputeId: string;
  submittedBy: string;
  type: string;
  title: string;
  content: string;
  metadata: string | null;
  isAppeal: boolean;
  createdAt: Date;
}

export interface DecisionResponse {
  decisionId: string;
  disputeId: string;
  arbitratorId: string;
  decision: string;
  rationale: string;
  paymentBps: number;
  isAppeal: boolean;
  createdAt: Date;
}

export interface AuditLogResponse {
  logId: string;
  disputeId: string;
  actorId: string;
  action: string;
  payload: string | null;
  createdAt: Date;
}
