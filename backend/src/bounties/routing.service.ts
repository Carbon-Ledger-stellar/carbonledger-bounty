import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Difficulty } from './bounties.dto';

// ── Types ────────────────────────────────────────────────────────────────────

export type SkillLevel = 'junior' | 'mid' | 'senior' | 'expert';
export type RoutingStatus = 'pending' | 'routed' | 'escalated' | 'manual_review';
export type EscalationReason = 'no_applications_48h' | 'no_applications_5d';

/** A contributor profile used by the routing engine. */
export interface ContributorProfile {
  id: string;
  skillLevel: SkillLevel;
  /** Tags the contributor is qualified for (e.g. 'rust', 'nestjs'). */
  skills: string[];
  /** 0–100 reputation score. */
  reputationScore: number;
  /** Whether the contributor is currently available to take work. */
  available: boolean;
  /** Number of bounties currently in progress. */
  activeBountyCount: number;
}

/** Criteria used to match and rank contributors for a bounty. */
export interface RoutingCriteria {
  difficulty: Difficulty;
  requiredSkills: string[];
  /** Minimum reputation score to be considered. */
  minReputation: number;
}

/** One entry in the immutable audit log. */
export interface RoutingAuditEntry {
  id: string;
  bountyId: string;
  timestamp: Date;
  action:
    | 'initial_routing'
    | 'escalation_price_drop'
    | 'escalation_manual_review'
    | 'admin_override';
  criteria: RoutingCriteria;
  candidateIds: string[];
  /** Top-5 contributors selected (IDs). */
  selectedContributorIds: string[];
  /** New price after an escalation price-drop, undefined otherwise. */
  newPrice?: number;
  /** Free-text note (e.g. admin override reason). */
  note?: string;
}

/** State the routing engine tracks per bounty. */
export interface BountyRoutingState {
  bountyId: string;
  basePrice: number;
  currentPrice: number;
  /** Price cannot fall below 50 % of base price. */
  priceFloor: number;
  status: RoutingStatus;
  routedAt: Date;
  firstApplicationAt?: Date;
  /** How many times the price has already been dropped by escalation. */
  priceDropsApplied: number;
  selectedContributorIds: string[];
  manualOverrideContributorId?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum skill level required per difficulty tier. */
const DIFFICULTY_MIN_SKILL: Record<Difficulty, SkillLevel> = {
  beginner: 'junior',
  intermediate: 'mid',
  advanced: 'senior',
  expert: 'expert',
};

const SKILL_RANK: Record<SkillLevel, number> = {
  junior: 0,
  mid: 1,
  senior: 2,
  expert: 3,
};

/** How many top candidates the engine selects per routing run. */
const TOP_N = 5;

/** After this many ms with no application, drop price by 10 %. */
const ESCALATION_48H_MS = 48 * 60 * 60 * 1000;

/** After this many ms with no application, flag for manual review. */
const ESCALATION_5D_MS = 5 * 24 * 60 * 60 * 1000;

/** Price drop percentage applied at 48 h escalation. */
const PRICE_DROP_RATE = 0.1;

/** Absolute price floor as a fraction of base price. */
const PRICE_FLOOR_FRACTION = 0.5;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  /** In-memory contributor registry (replace with DB in production). */
  private contributors: Map<string, ContributorProfile> = new Map();

  /** Per-bounty routing state. */
  private routingStates: Map<string, BountyRoutingState> = new Map();

  /** Immutable audit log — append-only. */
  private auditLog: RoutingAuditEntry[] = [];

  // ── Contributor registry ───────────────────────────────────────────────────

  /**
   * Register or update a contributor profile in the routing engine.
   */
  upsertContributor(profile: ContributorProfile): ContributorProfile {
    this.contributors.set(profile.id, profile);
    this.logger.log(`Contributor upserted: ${profile.id} (${profile.skillLevel})`);
    return profile;
  }

  getContributor(id: string): ContributorProfile {
    const c = this.contributors.get(id);
    if (!c) throw new NotFoundException(`Contributor ${id} not found`);
    return c;
  }

  listContributors(): ContributorProfile[] {
    return Array.from(this.contributors.values());
  }

  // ── Initial routing ────────────────────────────────────────────────────────

  /**
   * Route a newly created bounty.
   * Selects the top-5 most-qualified available contributors using a greedy
   * approach: complexity-tier → skill-level → availability → reputation.
   *
   * Returns the routing state (including the selected candidates) and appends
   * an audit entry.
   */
  routeBounty(
    bountyId: string,
    basePrice: number,
    criteria: RoutingCriteria,
    now: Date = new Date(),
  ): BountyRoutingState {
    if (this.routingStates.has(bountyId)) {
      throw new BadRequestException(`Bounty ${bountyId} has already been routed`);
    }

    const selected = this.selectTopCandidates(criteria);

    const priceFloor = basePrice * PRICE_FLOOR_FRACTION;
    const state: BountyRoutingState = {
      bountyId,
      basePrice,
      currentPrice: basePrice,
      priceFloor,
      status: 'routed',
      routedAt: now,
      priceDropsApplied: 0,
      selectedContributorIds: selected.map(c => c.id),
    };

    this.routingStates.set(bountyId, state);
    this.appendAudit({
      bountyId,
      action: 'initial_routing',
      criteria,
      candidateIds: Array.from(this.contributors.keys()),
      selectedContributorIds: state.selectedContributorIds,
    });

    this.logger.log(
      `Bounty ${bountyId} routed to [${state.selectedContributorIds.join(', ')}]`,
    );
    return state;
  }

  // ── Application recording ──────────────────────────────────────────────────

  /**
   * Call this when a contributor submits an application for a bounty.
   * Records the first-application timestamp (used to suppress escalation).
   */
  recordApplication(bountyId: string, _applicantId: string, now: Date = new Date()): void {
    const state = this.getState(bountyId);
    if (!state.firstApplicationAt) {
      state.firstApplicationAt = now;
      this.routingStates.set(bountyId, state);
      this.logger.log(`First application recorded for bounty ${bountyId}`);
    }
  }

  // ── Escalation ─────────────────────────────────────────────────────────────

  /**
   * Evaluate escalation conditions for a bounty at `now`.
   * Should be called periodically (e.g. by a scheduler or cron job).
   *
   * Rules:
   *  • If no application after 48 h  → drop price by 10 % (floor: 50 % of base).
   *  • If no application after 5 days → status = manual_review.
   *
   * Returns the (possibly mutated) routing state.
   */
  evaluateEscalation(bountyId: string, criteria: RoutingCriteria, now: Date = new Date()): BountyRoutingState {
    const state = this.getState(bountyId);

    // No escalation if an application has already been received.
    if (state.firstApplicationAt) return state;

    // No escalation if already in manual review.
    if (state.status === 'manual_review') return state;

    const elapsed = now.getTime() - state.routedAt.getTime();

    // 5-day escalation (checked first — takes priority over 48 h).
    if (elapsed >= ESCALATION_5D_MS) {
      state.status = 'manual_review';
      this.routingStates.set(bountyId, state);

      this.appendAudit({
        bountyId,
        action: 'escalation_manual_review',
        criteria,
        candidateIds: state.selectedContributorIds,
        selectedContributorIds: state.selectedContributorIds,
        note: 'No application received within 5 days; flagged for manual review.',
      });

      this.logger.warn(`Bounty ${bountyId} escalated to manual review (5d no application)`);
      return state;
    }

    // 48-hour price-drop escalation.
    if (elapsed >= ESCALATION_48H_MS) {
      const newPrice = Math.max(
        state.currentPrice * (1 - PRICE_DROP_RATE),
        state.priceFloor,
      );

      if (newPrice !== state.currentPrice) {
        state.currentPrice = newPrice;
        state.priceDropsApplied += 1;
        state.status = 'escalated';
        this.routingStates.set(bountyId, state);

        this.appendAudit({
          bountyId,
          action: 'escalation_price_drop',
          criteria,
          candidateIds: state.selectedContributorIds,
          selectedContributorIds: state.selectedContributorIds,
          newPrice,
          note: `Price dropped by ${PRICE_DROP_RATE * 100}% due to no application in 48h.`,
        });

        this.logger.warn(
          `Bounty ${bountyId} price dropped to $${newPrice.toFixed(2)} (48h escalation)`,
        );
      }
    }

    return state;
  }

  // ── Admin override ─────────────────────────────────────────────────────────

  /**
   * Admin manually routes a bounty to a specific contributor.
   * The contributor does not need to pass the normal qualification filter.
   */
  adminOverride(
    bountyId: string,
    contributorId: string,
    criteria: RoutingCriteria,
    note?: string,
  ): BountyRoutingState {
    const state = this.getState(bountyId);
    const contributor = this.getContributor(contributorId);

    state.manualOverrideContributorId = contributor.id;
    state.selectedContributorIds = [contributor.id];
    state.status = 'routed';
    this.routingStates.set(bountyId, state);

    this.appendAudit({
      bountyId,
      action: 'admin_override',
      criteria,
      candidateIds: [contributorId],
      selectedContributorIds: [contributorId],
      note: note ?? `Admin manually routed to contributor ${contributorId}.`,
    });

    this.logger.log(`Admin override: bounty ${bountyId} → contributor ${contributorId}`);
    return state;
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  getRoutingState(bountyId: string): BountyRoutingState {
    return this.getState(bountyId);
  }

  /**
   * Return the full audit trail for a bounty, ordered oldest-first.
   */
  getAuditLog(bountyId: string): RoutingAuditEntry[] {
    return this.auditLog.filter(e => e.bountyId === bountyId);
  }

  /**
   * Return the entire audit log (all bounties).
   */
  getAllAuditEntries(): RoutingAuditEntry[] {
    return [...this.auditLog];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Greedy candidate selection:
   *   1. Filter by minimum skill level for the difficulty tier.
   *   2. Filter by required skills (contributor must have ALL required skills).
   *   3. Filter by availability (available === true, activeBountyCount < 3).
   *   4. Filter by minimum reputation.
   *   5. Sort by reputation desc, then skill level desc.
   *   6. Return top N.
   */
  private selectTopCandidates(criteria: RoutingCriteria): ContributorProfile[] {
    const minSkillRank = SKILL_RANK[DIFFICULTY_MIN_SKILL[criteria.difficulty]];

    return Array.from(this.contributors.values())
      .filter(c => SKILL_RANK[c.skillLevel] >= minSkillRank)
      .filter(c =>
        criteria.requiredSkills.every(s =>
          c.skills.map(sk => sk.toLowerCase()).includes(s.toLowerCase()),
        ),
      )
      .filter(c => c.available && c.activeBountyCount < 3)
      .filter(c => c.reputationScore >= criteria.minReputation)
      .sort((a, b) => {
        // Primary: reputation (desc)
        const repDiff = b.reputationScore - a.reputationScore;
        if (repDiff !== 0) return repDiff;
        // Secondary: skill level (desc)
        return SKILL_RANK[b.skillLevel] - SKILL_RANK[a.skillLevel];
      })
      .slice(0, TOP_N);
  }

  private getState(bountyId: string): BountyRoutingState {
    const state = this.routingStates.get(bountyId);
    if (!state) throw new NotFoundException(`No routing state found for bounty ${bountyId}`);
    return state;
  }

  private appendAudit(
    entry: Omit<RoutingAuditEntry, 'id' | 'timestamp'>,
  ): void {
    const full: RoutingAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...entry,
    };
    this.auditLog.push(full);
  }
}
