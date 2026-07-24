import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateNested,
  ArrayMinSize,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EscrowStatus,
  MilestoneStatus,
  MILESTONE_STATUSES,
} from './milestone.model';

// ── Escrow DTOs ───────────────────────────────────────────────────────────────

export class CreateMilestoneInputDto {
  @IsString()
  @MinLength(5)
  description: string;

  /** ISO-8601 date string */
  @IsDateString()
  dueDate: string;

  /** Stellar public key of the reviewer */
  @IsString()
  @MinLength(10)
  reviewerAddress: string;

  /** USD amount to hold in escrow for this milestone */
  @IsNumber()
  @IsPositive()
  paymentAmount: number;
}

/**
 * Create a new escrow account and its initial milestones in one call.
 * The sum of milestone paymentAmounts must equal totalAmount.
 */
export class CreateEscrowDto {
  @IsString()
  bountyId: string;

  /** Total USD to lock in escrow. Must equal sum of milestone paymentAmounts. */
  @IsNumber()
  @IsPositive()
  totalAmount: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneInputDto)
  milestones: CreateMilestoneInputDto[];
}

/**
 * Add a new milestone to an existing active escrow.
 */
export class AddMilestoneDto {
  @IsString()
  @MinLength(5)
  description: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  @MinLength(10)
  reviewerAddress: string;

  @IsNumber()
  @IsPositive()
  paymentAmount: number;
}

/**
 * Contributor submits a milestone for review.
 * Transitions: planned → in-review
 */
export class SubmitMilestoneDto {
  /**
   * Optional submission notes or PR link shown to the reviewer.
   * Stored in the audit log payload, not on the milestone itself.
   */
  @IsOptional()
  @IsString()
  submissionNotes?: string;
}

/**
 * Reviewer approves a milestone.
 * Transitions: in-review → approved (funds queued)
 */
export class ApproveMilestoneDto {
  @IsOptional()
  @IsString()
  approvalNotes?: string;
}

/**
 * Reviewer rejects a milestone.
 * Transitions: in-review → rejected
 */
export class RejectMilestoneDto {
  /**
   * Mandatory written feedback explaining what needs to be reworked.
   * Minimum 10 characters prevents trivial rejections.
   */
  @IsString()
  @MinLength(10)
  feedback: string;
}

/**
 * Contributor acknowledges rejection and resets milestone for re-work.
 * Transitions: rejected → planned
 */
export class StartReworkDto {
  @IsOptional()
  @IsString()
  reworkNotes?: string;
}

/**
 * Query params for listing milestones.
 */
export class MilestoneQueryDto {
  @IsOptional()
  @IsIn(MILESTONE_STATUSES)
  status?: MilestoneStatus;

  @IsOptional()
  @IsString()
  reviewerAddress?: string;
}

/**
 * Query params for listing audit log entries.
 */
export class AuditQueryDto {
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  /** Return at most this many entries (default: 100) */
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}

// ── Response shapes ───────────────────────────────────────────────────────────

export interface EscrowResponse {
  id: string;
  bountyId: string;
  totalAmount: number;
  releasedAmount: number;
  pendingAmount: number;   // totalAmount - releasedAmount
  status: EscrowStatus;
  milestoneCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MilestoneResponse {
  id: string;
  escrowId: string;
  bountyId: string;
  description: string;
  dueDate: Date;
  reviewerAddress: string;
  paymentAmount: number;
  status: MilestoneStatus;
  rejectionFeedback: string | null;
  submittedAt: Date | null;
  fundsReleasedAt: Date | null;
  autoReleased: boolean;
  /** Seconds remaining before reviewer timeout triggers auto-release. Null when not in-review. */
  reviewerTimeoutRemainingSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogResponse {
  id: string;
  escrowId: string;
  milestoneId: string | null;
  actorId: string;
  action: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}
