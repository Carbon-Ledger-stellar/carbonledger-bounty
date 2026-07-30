/**
 * Milestone model types and domain constants for the escrow payment system.
 *
 * State machine:
 *
 *   planned ──► in-review ──► approved ──► funds-released
 *                   │
 *                   └──► rejected ──► planned  (re-work cycle)
 *
 * Auto-release: if reviewer does not respond within REVIEWER_TIMEOUT_DAYS
 * the scheduler transitions in-review → approved → funds-released automatically.
 */

// ── State machine ─────────────────────────────────────────────────────────────

export type MilestoneStatus =
  | 'planned'        // Created, not yet submitted for review
  | 'in-review'      // Contributor submitted; awaiting reviewer decision
  | 'approved'       // Reviewer approved; funds queued for release
  | 'funds-released' // Payment disbursed to contributor
  | 'rejected';      // Reviewer rejected; contributor must rework

export const MILESTONE_STATUSES: MilestoneStatus[] = [
  'planned',
  'in-review',
  'approved',
  'funds-released',
  'rejected',
];

/** Legal next states for each status. Used by the service for validation. */
export const MILESTONE_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  'planned':        ['in-review'],
  'in-review':      ['approved', 'rejected'],
  'approved':       ['funds-released'],
  'funds-released': [],             // terminal
  'rejected':       ['planned'],    // re-work: back to planned after contributor revision
};

// ── Domain constants ──────────────────────────────────────────────────────────

/** Days before a reviewer's non-response triggers auto-release. */
export const REVIEWER_TIMEOUT_DAYS = 7;

/** How often the auto-release scheduler polls, in milliseconds. */
export const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000; // every hour

// ── Escrow account status ─────────────────────────────────────────────────────

export type EscrowStatus =
  | 'active'    // Funds locked, milestones in progress
  | 'completed' // All milestones funded-released
  | 'cancelled' // Escrow voided before completion; funds returned

export const ESCROW_STATUSES: EscrowStatus[] = ['active', 'completed', 'cancelled'];

// ── Audit action constants ────────────────────────────────────────────────────

export const ESCROW_ACTIONS = {
  ESCROW_CREATED:           'ESCROW_CREATED',
  ESCROW_FUNDED:            'ESCROW_FUNDED',
  ESCROW_COMPLETED:         'ESCROW_COMPLETED',
  ESCROW_CANCELLED:         'ESCROW_CANCELLED',

  MILESTONE_CREATED:        'MILESTONE_CREATED',
  MILESTONE_SUBMITTED:      'MILESTONE_SUBMITTED',   // planned → in-review
  MILESTONE_APPROVED:       'MILESTONE_APPROVED',    // in-review → approved
  MILESTONE_REJECTED:       'MILESTONE_REJECTED',    // in-review → rejected
  MILESTONE_REWORK_STARTED: 'MILESTONE_REWORK_STARTED', // rejected → planned
  MILESTONE_FUNDS_RELEASED: 'MILESTONE_FUNDS_RELEASED', // approved → funds-released
  MILESTONE_AUTO_RELEASED:  'MILESTONE_AUTO_RELEASED',  // timeout triggered release
} as const;

export type EscrowAction = (typeof ESCROW_ACTIONS)[keyof typeof ESCROW_ACTIONS];

// ── Domain model interfaces ───────────────────────────────────────────────────

/**
 * A single deliverable within a bounty, backed by a portion of the escrow.
 * Maps directly to the `BountyMilestone` Prisma model.
 */
export interface Milestone {
  id: string;
  escrowId: string;
  bountyId: string;
  /** Human-readable deliverable description */
  description: string;
  /** Hard deadline for the milestone */
  dueDate: Date;
  /** Stellar public key / address of the reviewer responsible for this milestone */
  reviewerAddress: string;
  /** USD amount held in escrow for this milestone */
  paymentAmount: number;
  status: MilestoneStatus;
  /** Optional feedback attached on rejection; cleared on re-submission */
  rejectionFeedback?: string | null;
  /** Timestamp when status moved to in-review (used for timeout calculation) */
  submittedAt?: Date | null;
  /** Timestamp when funds were released */
  fundsReleasedAt?: Date | null;
  /** Whether release was triggered automatically by the timeout scheduler */
  autoReleased: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Escrow account that holds funds for an entire bounty's milestones.
 * Maps directly to the `EscrowAccount` Prisma model.
 */
export interface EscrowAccount {
  id: string;
  bountyId: string;
  /** Total USD amount locked in this escrow */
  totalAmount: number;
  /** Running total of funds already released to the contributor */
  releasedAmount: number;
  status: EscrowStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single entry in the immutable escrow audit trail.
 * Maps directly to the `EscrowAuditLog` Prisma model.
 */
export interface EscrowAuditEntry {
  id: string;
  escrowId: string;
  milestoneId?: string | null;
  actorId: string;
  action: EscrowAction;
  /** JSON-serialised snapshot of relevant state at the time of the action */
  payload?: string | null;
  createdAt: Date;
}
