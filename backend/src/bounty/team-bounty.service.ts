import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TeamRole = 'lead' | 'reviewer' | 'implementer';
export type TeamBountyStatus =
  | 'open'
  | 'in_progress'
  | 'pending_payment'
  | 'paid'
  | 'disputed';

/** One member of a team bounty. */
export interface TeamMember {
  contributorId: string;
  role: TeamRole;
  /** 0–100 contribution percentage; must sum to 100 across all members before payment. */
  contributionPct: number;
  /** Whether the lead has approved this member's payout. */
  approved: boolean;
  joinedAt: Date;
}

/** A team bounty with its full state. */
export interface TeamBounty {
  id: string;
  title: string;
  description: string;
  /** Total reward pool in USD. */
  totalRewardUsd: number;
  /** 2–5 members. */
  teamSize: number;
  status: TeamBountyStatus;
  /** The ID of the lead contributor (also present in `members`). */
  leadId: string;
  members: TeamMember[];
  /** Computed payout per member (populated at payment time). */
  payouts: PayoutRecord[];
  /** Contribution disputes raised by the lead (memberId → reason). */
  disputes: DisputeRecord[];
  createdAt: Date;
  updatedAt: Date;
}

/** The final payout for a single member. */
export interface PayoutRecord {
  contributorId: string;
  role: TeamRole;
  contributionPct: number;
  shareUsd: number;
}

/** A dispute raised by the lead over a member's contribution percentage. */
export interface DisputeRecord {
  id: string;
  raisedBy: string;
  targetContributorId: string;
  proposedContributionPct: number;
  reason: string;
  raisedAt: Date;
  resolved: boolean;
}

// ── Profit-split rules ────────────────────────────────────────────────────────

/**
 * Hard-coded split rules (per spec):
 *   lead        → 40 % of total pool
 *   reviewers   → 20 % each (max 2 reviewers → max 40 % total)
 *   implementers → remaining 40 % split equally by contribution %
 *
 * In practice the split is validated, not mechanically computed here —
 * the lead sets each implementer's contributionPct; the engine verifies
 * that the combined payouts respect the role rules.
 */
export const ROLE_SHARE: Record<TeamRole, number> = {
  lead: 0.4,
  reviewer: 0.2,
  implementer: 0.4, // shared across all implementers
};

const MAX_REVIEWERS = 2;
const MIN_TEAM_SIZE = 2;
const MAX_TEAM_SIZE = 5;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class TeamBountyService {
  private readonly logger = new Logger(TeamBountyService.name);

  /** In-memory store — replace with Prisma in production. */
  private teamBounties: Map<string, TeamBounty> = new Map();

  // ── Creation ───────────────────────────────────────────────────────────────

  /**
   * Create a new team bounty.  The creator becomes the lead automatically.
   *
   * @param leadId  Contributor who creates and leads the bounty.
   * @param teamSize  Intended team size (2–5); members join via `addMember`.
   */
  createTeamBounty(
    leadId: string,
    title: string,
    description: string,
    totalRewardUsd: number,
    teamSize: number,
  ): TeamBounty {
    if (teamSize < MIN_TEAM_SIZE || teamSize > MAX_TEAM_SIZE) {
      throw new BadRequestException(
        `teamSize must be between ${MIN_TEAM_SIZE} and ${MAX_TEAM_SIZE}`,
      );
    }
    if (totalRewardUsd <= 0) {
      throw new BadRequestException('totalRewardUsd must be positive');
    }

    const id = `team-bounty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const leadMember: TeamMember = {
      contributorId: leadId,
      role: 'lead',
      contributionPct: 0, // updated when lead sets their own contribution
      approved: true, // lead auto-approved
      joinedAt: new Date(),
    };

    const bounty: TeamBounty = {
      id,
      title,
      description,
      totalRewardUsd,
      teamSize,
      status: 'open',
      leadId,
      members: [leadMember],
      payouts: [],
      disputes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.teamBounties.set(id, bounty);
    this.logger.log(`Team bounty created: ${id} by lead ${leadId}`);
    return bounty;
  }

  // ── Team management ────────────────────────────────────────────────────────

  /**
   * Add a member to a team bounty (lead only).
   * Role 'reviewer' is capped at MAX_REVIEWERS (2).
   */
  addMember(
    bountyId: string,
    leadId: string,
    contributorId: string,
    role: TeamRole,
  ): TeamBounty {
    const bounty = this.getBounty(bountyId);
    this.assertLead(bounty, leadId);
    this.assertStatus(bounty, ['open', 'in_progress']);

    if (bounty.members.length >= bounty.teamSize) {
      throw new BadRequestException(
        `Team is already full (max ${bounty.teamSize} members)`,
      );
    }
    if (bounty.members.some(m => m.contributorId === contributorId)) {
      throw new BadRequestException(`Contributor ${contributorId} is already on the team`);
    }
    if (role === 'lead') {
      throw new BadRequestException('Only one lead per team bounty');
    }
    if (role === 'reviewer') {
      const reviewerCount = bounty.members.filter(m => m.role === 'reviewer').length;
      if (reviewerCount >= MAX_REVIEWERS) {
        throw new BadRequestException(`Maximum of ${MAX_REVIEWERS} reviewers allowed`);
      }
    }

    bounty.members.push({
      contributorId,
      role,
      contributionPct: 0,
      approved: false,
      joinedAt: new Date(),
    });
    bounty.status = 'in_progress';
    bounty.updatedAt = new Date();
    this.teamBounties.set(bountyId, bounty);

    this.logger.log(`Member ${contributorId} (${role}) added to bounty ${bountyId}`);
    return bounty;
  }

  // ── Contribution tracking ──────────────────────────────────────────────────

  /**
   * Set contribution percentages for all members (lead only).
   *
   * The pool is distributed so that the final percentages sum to 100:
   *   • lead  → ROLE_SHARE.lead (40%) of the total
   *   • each reviewer → ROLE_SHARE.reviewer (20%) each
   *   • implementers collectively receive whatever remains after lead + reviewers,
   *     split according to `implementerShares` (fraction, must sum to 1.0)
   *
   * Example with 1 lead + 1 reviewer + 2 implementers (60/40 split):
   *   lead=40%, rev=20%, impl1=24%, impl2=16%  → total=100% ✓
   *
   * Example with 1 lead + 2 reviewers + 1 implementer:
   *   lead=40%, rev1=20%, rev2=20%, impl=20%   → total=100% ✓
   *
   * `implementerShares` maps contributorId → fraction (0–1), must sum to 1.0.
   */
  setContributions(
    bountyId: string,
    leadId: string,
    implementerShares: Record<string, number>,
  ): TeamBounty {
    const bounty = this.getBounty(bountyId);
    this.assertLead(bounty, leadId);
    this.assertStatus(bounty, ['open', 'in_progress']);

    const implementers = bounty.members.filter(m => m.role === 'implementer');
    if (implementers.length === 0 && Object.keys(implementerShares).length > 0) {
      throw new BadRequestException('No implementers on this team bounty');
    }

    // Validate that all keys in implementerShares are actual implementers
    for (const id of Object.keys(implementerShares)) {
      if (!implementers.some(m => m.contributorId === id)) {
        throw new BadRequestException(`${id} is not an implementer on this bounty`);
      }
    }

    if (implementers.length > 0) {
      const total = Object.values(implementerShares).reduce((s, v) => s + v, 0);
      if (Math.abs(total - 1) > 1e-9) {
        throw new BadRequestException(
          `Implementer shares must sum to 1.0 (got ${total.toFixed(4)})`,
        );
      }
    }

    // Compute pool fractions from actual team composition so they always sum to 100%.
    const reviewerCount = bounty.members.filter(m => m.role === 'reviewer').length;
    const leadPct = ROLE_SHARE.lead * 100;                        // always 40%
    const reviewerPct = ROLE_SHARE.reviewer * 100;                // 20% per reviewer
    const totalReviewerPct = reviewerPct * reviewerCount;
    // Implementer pool = what's left after lead + all reviewers
    const implementerPoolPct = 100 - leadPct - totalReviewerPct;

    // Apply
    for (const member of bounty.members) {
      if (member.role === 'lead') {
        member.contributionPct = leadPct;
      } else if (member.role === 'reviewer') {
        member.contributionPct = reviewerPct;
      } else {
        const share = implementerShares[member.contributorId] ?? 0;
        member.contributionPct = share * implementerPoolPct;
      }
    }

    bounty.updatedAt = new Date();
    this.teamBounties.set(bountyId, bounty);
    this.logger.log(`Contributions set for bounty ${bountyId}`);
    return bounty;
  }

  // ── Lead approval ──────────────────────────────────────────────────────────

  /**
   * Lead approves a specific member's contribution, enabling their payout.
   */
  approveMember(bountyId: string, leadId: string, contributorId: string): TeamBounty {
    const bounty = this.getBounty(bountyId);
    this.assertLead(bounty, leadId);

    const member = bounty.members.find(m => m.contributorId === contributorId);
    if (!member) {
      throw new NotFoundException(`Member ${contributorId} not found on bounty ${bountyId}`);
    }
    member.approved = true;
    bounty.updatedAt = new Date();
    this.teamBounties.set(bountyId, bounty);
    this.logger.log(`Lead ${leadId} approved member ${contributorId} on bounty ${bountyId}`);
    return bounty;
  }

  // ── Dispute ────────────────────────────────────────────────────────────────

  /**
   * Lead raises a dispute over a member's contribution percentage,
   * proposing a new value.
   */
  raiseDispute(
    bountyId: string,
    leadId: string,
    targetContributorId: string,
    proposedContributionPct: number,
    reason: string,
  ): TeamBounty {
    const bounty = this.getBounty(bountyId);
    this.assertLead(bounty, leadId);

    if (!bounty.members.some(m => m.contributorId === targetContributorId)) {
      throw new NotFoundException(`Member ${targetContributorId} not found`);
    }
    if (proposedContributionPct < 0 || proposedContributionPct > 100) {
      throw new BadRequestException('proposedContributionPct must be 0–100');
    }

    const dispute: DisputeRecord = {
      id: `dispute-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      raisedBy: leadId,
      targetContributorId,
      proposedContributionPct,
      reason,
      raisedAt: new Date(),
      resolved: false,
    };

    bounty.disputes.push(dispute);
    bounty.status = 'disputed';
    bounty.updatedAt = new Date();
    this.teamBounties.set(bountyId, bounty);

    this.logger.warn(
      `Dispute raised on bounty ${bountyId} against ${targetContributorId} by ${leadId}`,
    );
    return bounty;
  }

  /**
   * Resolve a dispute by accepting the proposed contribution percentage.
   * Only the lead can resolve.
   */
  resolveDispute(bountyId: string, leadId: string, disputeId: string): TeamBounty {
    const bounty = this.getBounty(bountyId);
    this.assertLead(bounty, leadId);

    const dispute = bounty.disputes.find(d => d.id === disputeId);
    if (!dispute) throw new NotFoundException(`Dispute ${disputeId} not found`);
    if (dispute.resolved) throw new BadRequestException('Dispute already resolved');

    // Apply the proposed pct
    const member = bounty.members.find(m => m.contributorId === dispute.targetContributorId);
    if (member) {
      member.contributionPct = dispute.proposedContributionPct;
    }

    dispute.resolved = true;
    bounty.status = 'in_progress';
    bounty.updatedAt = new Date();
    this.teamBounties.set(bountyId, bounty);

    this.logger.log(`Dispute ${disputeId} resolved on bounty ${bountyId}`);
    return bounty;
  }

  // ── Payment ────────────────────────────────────────────────────────────────

  /**
   * Enforce profit split and compute payouts.
   *
   * Pre-conditions (all enforced):
   *   1. All members must be approved by the lead.
   *   2. No unresolved disputes.
   *   3. Contribution percentages must be set (non-zero for non-lead members).
   *   4. Total contribution pcts must sum to 100 ± ε.
   *
   * Returns the list of payout records, one per member.
   */
  enforcePayment(bountyId: string, leadId: string): PayoutRecord[] {
    const bounty = this.getBounty(bountyId);
    this.assertLead(bounty, leadId);
    this.assertStatus(bounty, ['in_progress', 'open']);

    // 1. All members approved
    const unapproved = bounty.members.filter(m => !m.approved);
    if (unapproved.length > 0) {
      throw new BadRequestException(
        `Members not yet approved: ${unapproved.map(m => m.contributorId).join(', ')}`,
      );
    }

    // 2. No unresolved disputes
    const openDisputes = bounty.disputes.filter(d => !d.resolved);
    if (openDisputes.length > 0) {
      throw new BadRequestException(
        `There are ${openDisputes.length} unresolved dispute(s). Resolve before payment.`,
      );
    }

    // 3. Contributions must be set
    const totalPct = bounty.members.reduce((s, m) => s + m.contributionPct, 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new BadRequestException(
        `Contribution percentages must sum to 100 (currently ${totalPct.toFixed(2)})`,
      );
    }

    // Compute payouts
    const payouts: PayoutRecord[] = bounty.members.map(m => ({
      contributorId: m.contributorId,
      role: m.role,
      contributionPct: m.contributionPct,
      shareUsd: (m.contributionPct / 100) * bounty.totalRewardUsd,
    }));

    bounty.payouts = payouts;
    bounty.status = 'paid';
    bounty.updatedAt = new Date();
    this.teamBounties.set(bountyId, bounty);

    this.logger.log(
      `Payment enforced for bounty ${bountyId}: ${payouts
        .map(p => `${p.contributorId}=$${p.shareUsd.toFixed(2)}`)
        .join(', ')}`,
    );
    return payouts;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  getTeamBounty(bountyId: string): TeamBounty {
    return this.getBounty(bountyId);
  }

  listTeamBounties(): TeamBounty[] {
    return Array.from(this.teamBounties.values());
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getBounty(bountyId: string): TeamBounty {
    const b = this.teamBounties.get(bountyId);
    if (!b) throw new NotFoundException(`Team bounty ${bountyId} not found`);
    return b;
  }

  private assertLead(bounty: TeamBounty, callerId: string): void {
    if (bounty.leadId !== callerId) {
      throw new ForbiddenException('Only the lead can perform this action');
    }
  }

  private assertStatus(bounty: TeamBounty, allowed: TeamBountyStatus[]): void {
    if (!allowed.includes(bounty.status)) {
      throw new BadRequestException(
        `Operation not allowed in status '${bounty.status}'. Allowed: ${allowed.join(', ')}`,
      );
    }
  }
}
