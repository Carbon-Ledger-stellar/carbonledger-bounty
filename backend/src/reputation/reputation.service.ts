import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  RecordBountyCompletionDto,
  SubmitPeerRatingDto,
  UpsertContributorDto,
  LeaderboardQueryDto,
  ReputationBreakdownResponse,
  DimensionBreakdown,
  ImprovementTarget,
  ReputationTier,
  TrendDirection,
} from './reputation.dto';

// ── Local type definitions (mirrors generated Prisma types) ──────────────────
// These are used until `prisma generate` is run after the migration is applied.

interface ContributorRecord {
  id: string;
  walletAddress: string;
  displayName: string | null;
  reputationScore: number;
  codeQualityScore: number;
  timelinessScore: number;
  communicationScore: number;
  peerFeedbackScore: number;
  totalBountiesCompleted: number;
  totalBountiesOnTime: number;
  totalBountiesLate: number;
  totalBountiesVeryLate: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ReputationHistoryRecord {
  id: string;
  contributorId: string;
  scoreBefore: number;
  scoreAfter: number;
  codeQualityBefore: number;
  codeQualityAfter: number;
  timelinessBefore: number;
  timelinessAfter: number;
  communicationBefore: number;
  communicationAfter: number;
  peerFeedbackBefore: number;
  peerFeedbackAfter: number;
  bountyId: string | null;
  reviewerScore: number | null;
  submittedAt: Date | null;
  deadlineAt: Date | null;
  avgResponseHours: number | null;
  peerRating: number | null;
  changeReason: string | null;
  createdAt: Date;
}

// Prisma client extended with reputation tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaWithReputation = PrismaService & Record<string, any>;

// ── Dimension weights (must sum to 1.0) ──────────────────────────────────────
const WEIGHTS = {
  codeQuality: 0.4,
  timeliness: 0.3,
  communication: 0.2,
  peerFeedback: 0.1,
} as const;

// ── Timeliness thresholds (in milliseconds) ──────────────────────────────────
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// ── Communication scoring ─────────────────────────────────────────────────────
// Response latency → score: ≤4 h → 100, ≤24 h → 80, ≤72 h → 60, ≤168 h → 30, >168 h → 0
const RESPONSE_THRESHOLDS: Array<{ maxHours: number; score: number }> = [
  { maxHours: 4, score: 100 },
  { maxHours: 24, score: 80 },
  { maxHours: 72, score: 60 },
  { maxHours: 168, score: 30 },
  { maxHours: Infinity, score: 0 },
];

// ── Tier thresholds ──────────────────────────────────────────────────────────
const TIERS: Array<{ min: number; tier: ReputationTier }> = [
  { min: 80, tier: 'elite' },
  { min: 65, tier: 'trusted' },
  { min: 45, tier: 'established' },
  { min: 0, tier: 'rising' },
];

// ── Trend detection: look at last N history events ───────────────────────────
const TREND_WINDOW = 5;

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);
  /** Cast to extended type so TypeScript accepts the new Prisma models. */
  private readonly db: PrismaWithReputation;

  constructor(private readonly prisma: PrismaService) {
    this.db = prisma as PrismaWithReputation;
  }

  // ── Contributor CRUD ──────────────────────────────────────────────────────

  /**
   * Upsert a contributor record. Called on first interaction.
   */
  async upsertContributor(dto: UpsertContributorDto): Promise<ContributorRecord> {
    return this.db.contributor.upsert({
      where: { walletAddress: dto.walletAddress },
      create: {
        walletAddress: dto.walletAddress,
        displayName: dto.displayName ?? null,
      },
      update: {
        displayName: dto.displayName ?? undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Fetch a single contributor by wallet address.
   */
  async getContributor(walletAddress: string): Promise<ContributorRecord> {
    const contributor = await this.db.contributor.findUnique({
      where: { walletAddress },
    });
    if (!contributor) {
      throw new NotFoundException(
        `Contributor with wallet ${walletAddress} not found`,
      );
    }
    return contributor;
  }

  // ── Core reputation update ────────────────────────────────────────────────

  /**
   * Record a bounty completion and immediately update the contributor's
   * reputation score across all four dimensions.
   *
   * Weights:
   *   code-quality   40%
   *   timeliness     30%
   *   communication  20%
   *   peer-feedback  10%
   */
  async recordBountyCompletion(
    dto: RecordBountyCompletionDto,
  ): Promise<ReputationBreakdownResponse> {
    // Ensure contributor exists
    let contributor = await this.db.contributor.findUnique({
      where: { walletAddress: dto.walletAddress },
    });
    if (!contributor) {
      contributor = await this.upsertContributor({
        walletAddress: dto.walletAddress,
      });
    }

    // ── 1. Calculate individual dimension scores ──────────────────────────
    const newCodeQuality = this.scoreCodeQuality(dto.reviewerScore);
    const newTimeliness = this.scoreTimeliness(
      new Date(dto.submittedAt),
      new Date(dto.deadlineAt),
    );
    const newCommunication = this.scoreCommunication(dto.avgResponseHours);
    const newPeerFeedback = dto.peerRating != null
      ? this.scorePeerFeedback(dto.peerRating)
      : contributor.peerFeedbackScore; // carry forward if not provided

    // ── 2. Rolling average with the contributor's existing score ──────────
    //       weighted_new = 0.3 * new + 0.7 * existing  (recency bias)
    const alpha = 0.3;
    const updatedCodeQuality = this.rollingAverage(
      contributor.codeQualityScore,
      newCodeQuality,
      alpha,
    );
    const updatedTimeliness = this.rollingAverage(
      contributor.timelinessScore,
      newTimeliness,
      alpha,
    );
    const updatedCommunication = this.rollingAverage(
      contributor.communicationScore,
      newCommunication,
      alpha,
    );
    const updatedPeerFeedback = dto.peerRating != null
      ? this.rollingAverage(contributor.peerFeedbackScore, newPeerFeedback, alpha)
      : contributor.peerFeedbackScore;

    // ── 3. Composite score ────────────────────────────────────────────────
    const updatedReputation = this.computeComposite(
      updatedCodeQuality,
      updatedTimeliness,
      updatedCommunication,
      updatedPeerFeedback,
    );

    // ── 4. Timeliness counters ────────────────────────────────────────────
    const submitted = new Date(dto.submittedAt);
    const deadline = new Date(dto.deadlineAt);
    const latencyMs = submitted.getTime() - deadline.getTime();
    const isOnTime = latencyMs <= 0;
    const isLate = latencyMs > 0 && latencyMs <= ONE_WEEK_MS;
    const isVeryLate = latencyMs > ONE_WEEK_MS;

    // ── 5. Persist updates in a transaction ──────────────────────────────
    const [updated] = await this.db.$transaction([
      this.db.contributor.update({
        where: { id: contributor.id },
        data: {
          reputationScore: updatedReputation,
          codeQualityScore: updatedCodeQuality,
          timelinessScore: updatedTimeliness,
          communicationScore: updatedCommunication,
          peerFeedbackScore: updatedPeerFeedback,
          totalBountiesCompleted: { increment: 1 },
          totalBountiesOnTime: isOnTime ? { increment: 1 } : undefined,
          totalBountiesLate: isLate ? { increment: 1 } : undefined,
          totalBountiesVeryLate: isVeryLate ? { increment: 1 } : undefined,
          updatedAt: new Date(),
        },
      }),
      this.db.reputationHistory.create({
        data: {
          contributorId: contributor.id,
          scoreBefore: contributor.reputationScore,
          scoreAfter: updatedReputation,
          codeQualityBefore: contributor.codeQualityScore,
          codeQualityAfter: updatedCodeQuality,
          timelinessBefore: contributor.timelinessScore,
          timelinessAfter: updatedTimeliness,
          communicationBefore: contributor.communicationScore,
          communicationAfter: updatedCommunication,
          peerFeedbackBefore: contributor.peerFeedbackScore,
          peerFeedbackAfter: updatedPeerFeedback,
          bountyId: dto.bountyId,
          reviewerScore: dto.reviewerScore,
          submittedAt: new Date(dto.submittedAt),
          deadlineAt: new Date(dto.deadlineAt),
          avgResponseHours: dto.avgResponseHours,
          peerRating: dto.peerRating ?? null,
          changeReason: `Bounty ${dto.bountyId} completed`,
        },
      }),
    ]);

    this.logger.log(
      `Reputation updated for ${dto.walletAddress}: ` +
        `${contributor.reputationScore.toFixed(1)} → ${updatedReputation.toFixed(1)}`,
    );

    return this.buildBreakdown(updated);
  }

  /**
   * Submit a standalone peer rating (not tied to a bounty completion).
   * Only updates the peerFeedbackScore dimension.
   */
  async submitPeerRating(dto: SubmitPeerRatingDto): Promise<ReputationBreakdownResponse> {
    let contributor = await this.db.contributor.findUnique({
      where: { walletAddress: dto.walletAddress },
    });
    if (!contributor) {
      contributor = await this.upsertContributor({ walletAddress: dto.walletAddress });
    }

    const newPeerScore = this.scorePeerFeedback(dto.rating);
    const updatedPeer = this.rollingAverage(contributor.peerFeedbackScore, newPeerScore, 0.3);
    const updatedReputation = this.computeComposite(
      contributor.codeQualityScore,
      contributor.timelinessScore,
      contributor.communicationScore,
      updatedPeer,
    );

    const [updated] = await this.db.$transaction([
      this.db.contributor.update({
        where: { id: contributor.id },
        data: {
          peerFeedbackScore: updatedPeer,
          reputationScore: updatedReputation,
          updatedAt: new Date(),
        },
      }),
      this.db.reputationHistory.create({
        data: {
          contributorId: contributor.id,
          scoreBefore: contributor.reputationScore,
          scoreAfter: updatedReputation,
          codeQualityBefore: contributor.codeQualityScore,
          codeQualityAfter: contributor.codeQualityScore,
          timelinessBefore: contributor.timelinessScore,
          timelinessAfter: contributor.timelinessScore,
          communicationBefore: contributor.communicationScore,
          communicationAfter: contributor.communicationScore,
          peerFeedbackBefore: contributor.peerFeedbackScore,
          peerFeedbackAfter: updatedPeer,
          bountyId: dto.bountyId ?? null,
          peerRating: dto.rating,
          changeReason: `Peer rating submitted${dto.comment ? ': ' + dto.comment : ''}`,
        },
      }),
    ]);

    return this.buildBreakdown(updated);
  }

  // ── Read endpoints ────────────────────────────────────────────────────────

  /**
   * Full reputation breakdown + improvement targets for the dashboard.
   */
  async getReputationBreakdown(
    walletAddress: string,
  ): Promise<ReputationBreakdownResponse> {
    const contributor = await this.db.contributor.findUnique({
      where: { walletAddress },
    });
    if (!contributor) {
      throw new NotFoundException(`Contributor ${walletAddress} not found`);
    }
    return this.buildBreakdown(contributor);
  }

  /**
   * Reputation change history (newest first).
   */
  async getHistory(
    walletAddress: string,
    limit = 20,
    offset = 0,
  ): Promise<ReputationHistoryRecord[]> {
    const contributor = await this.db.contributor.findUnique({
      where: { walletAddress },
    });
    if (!contributor) {
      throw new NotFoundException(`Contributor ${walletAddress} not found`);
    }

    return this.db.reputationHistory.findMany({
      where: { contributorId: contributor.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Global leaderboard sorted by chosen dimension.
   */
  async getLeaderboard(query: LeaderboardQueryDto) {
    const {
      sort = 'reputation',
      order = 'desc',
      page = 1,
      limit = 20,
    } = query;

    const sortField = this.leaderboardSortField(sort);
    const total = await this.db.contributor.count();
    const contributors = await this.db.contributor.findMany({
      orderBy: { [sortField]: order },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      data: contributors.map(c => ({
        walletAddress: c.walletAddress,
        displayName: c.displayName,
        reputationScore: round2(c.reputationScore),
        tier: this.computeTier(c.reputationScore),
        codeQualityScore: round2(c.codeQualityScore),
        timelinessScore: round2(c.timelinessScore),
        communicationScore: round2(c.communicationScore),
        peerFeedbackScore: round2(c.peerFeedbackScore),
        totalBountiesCompleted: c.totalBountiesCompleted,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit,
    };
  }

  // ── Scoring algorithms ────────────────────────────────────────────────────

  /**
   * Convert a 1–5 reviewer score to a 0–100 scale.
   * 5 → 100, 4 → 80, 3 → 60, 2 → 40, 1 → 20
   */
  scoreCodeQuality(reviewerScore: number): number {
    return clamp((reviewerScore / 5) * 100, 0, 100);
  }

  /**
   * Timeliness scoring:
   *   on-time or early    → 100
   *   up to 1 week late   → linear decay 100 → 50
   *   1–2 weeks late      → linear decay 50 → 0
   *   > 2 weeks late      → 0
   */
  scoreTimeliness(submittedAt: Date, deadlineAt: Date): number {
    const latencyMs = submittedAt.getTime() - deadlineAt.getTime();
    if (latencyMs <= 0) return 100;
    if (latencyMs <= ONE_WEEK_MS) {
      // linear 100 → 50 over the first week
      const fraction = latencyMs / ONE_WEEK_MS;
      return 100 - fraction * 50;
    }
    if (latencyMs <= TWO_WEEKS_MS) {
      // linear 50 → 0 over the second week
      const fraction = (latencyMs - ONE_WEEK_MS) / ONE_WEEK_MS;
      return 50 - fraction * 50;
    }
    return 0;
  }

  /**
   * Communication score based on average response latency to review comments.
   */
  scoreCommunication(avgResponseHours: number): number {
    for (const { maxHours, score } of RESPONSE_THRESHOLDS) {
      if (avgResponseHours <= maxHours) return score;
    }
    return 0;
  }

  /**
   * Convert 1–5 peer rating to 0–100.
   */
  scorePeerFeedback(peerRating: number): number {
    return clamp((peerRating / 5) * 100, 0, 100);
  }

  /**
   * Weighted composite score.
   */
  computeComposite(
    codeQuality: number,
    timeliness: number,
    communication: number,
    peerFeedback: number,
  ): number {
    return round2(
      codeQuality * WEIGHTS.codeQuality +
        timeliness * WEIGHTS.timeliness +
        communication * WEIGHTS.communication +
        peerFeedback * WEIGHTS.peerFeedback,
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Exponential moving average: blends the new observation into the existing score.
   * alpha = recency weight (0.3 means 30% new, 70% history).
   */
  private rollingAverage(existing: number, incoming: number, alpha: number): number {
    return round2(alpha * incoming + (1 - alpha) * existing);
  }

  private computeTier(score: number): ReputationTier {
    for (const { min, tier } of TIERS) {
      if (score >= min) return tier;
    }
    return 'rising';
  }

  /**
   * Analyse the last TREND_WINDOW history entries to determine trajectory.
   */
  private computeTrend(history: ReputationHistoryRecord[]): TrendDirection {
    if (history.length < 2) return 'insufficient_data';

    const window = history.slice(0, TREND_WINDOW);
    const deltas = window.map(h => h.scoreAfter - h.scoreBefore);
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;

    if (avgDelta > 1) return 'improving';
    if (avgDelta < -1) return 'declining';
    return 'stable';
  }

  /**
   * Build the improvement targets for contributors with low scores.
   * Each dimension with score < 70 gets a concrete target and advice.
   */
  private buildImprovementTargets(contributor: ContributorRecord): ImprovementTarget[] {
    const targets: ImprovementTarget[] = [];

    const dimensions = [
      {
        key: 'codeQuality',
        score: contributor.codeQualityScore,
        target: 80,
        label: 'Code Quality',
        advice:
          'Request more detailed code reviews, address all comments, and add comprehensive tests. ' +
          'Aim for a 4/5 reviewer rating on your next submission.',
      },
      {
        key: 'timeliness',
        score: contributor.timelinessScore,
        target: 80,
        label: 'Timeliness',
        advice:
          'Break down tasks into smaller chunks and communicate early if you anticipate a delay. ' +
          'Submitting before the deadline earns the full 100/100.',
      },
      {
        key: 'communication',
        score: contributor.communicationScore,
        target: 80,
        label: 'Communication',
        advice:
          'Respond to review comments within 4 hours for full marks. ' +
          'Set up notifications and aim to acknowledge comments the same day.',
      },
      {
        key: 'peerFeedback',
        score: contributor.peerFeedbackScore,
        target: 70,
        label: 'Peer Feedback',
        advice:
          'Engage with the community — help others in discussions, share learnings, ' +
          'and ask peers for honest feedback after each bounty.',
      },
    ];

    for (const dim of dimensions) {
      if (dim.score < dim.target) {
        targets.push({
          dimension: dim.label,
          currentScore: round2(dim.score),
          targetScore: dim.target,
          gap: round2(dim.target - dim.score),
          advice: dim.advice,
        });
      }
    }

    // Sort by largest gap first
    return targets.sort((a, b) => b.gap - a.gap);
  }

  private buildDimension(
    score: number,
    weight: number,
    label: string,
  ): DimensionBreakdown {
    return {
      score: round2(score),
      weight,
      weightedContribution: round2(score * weight),
      label,
    };
  }

  /**
   * Assemble the full dashboard response from a Contributor record.
   * History is fetched separately for trend detection.
   */
  private async buildBreakdown(
    contributor: ContributorRecord,
  ): Promise<ReputationBreakdownResponse> {
    const history = await this.db.reputationHistory.findMany({
      where: { contributorId: contributor.id },
      orderBy: { createdAt: 'desc' },
      take: TREND_WINDOW,
    });

    const onTimeRate =
      contributor.totalBountiesCompleted > 0
        ? round2(
            (contributor.totalBountiesOnTime / contributor.totalBountiesCompleted) * 100,
          )
        : 0;

    return {
      walletAddress: contributor.walletAddress,
      displayName: contributor.displayName,
      reputationScore: round2(contributor.reputationScore),
      tier: this.computeTier(contributor.reputationScore),
      dimensions: {
        codeQuality: this.buildDimension(
          contributor.codeQualityScore,
          WEIGHTS.codeQuality,
          'Code Quality',
        ),
        timeliness: this.buildDimension(
          contributor.timelinessScore,
          WEIGHTS.timeliness,
          'Timeliness',
        ),
        communication: this.buildDimension(
          contributor.communicationScore,
          WEIGHTS.communication,
          'Communication',
        ),
        peerFeedback: this.buildDimension(
          contributor.peerFeedbackScore,
          WEIGHTS.peerFeedback,
          'Peer Feedback',
        ),
      },
      stats: {
        totalBountiesCompleted: contributor.totalBountiesCompleted,
        totalBountiesOnTime: contributor.totalBountiesOnTime,
        totalBountiesLate: contributor.totalBountiesLate,
        totalBountiesVeryLate: contributor.totalBountiesVeryLate,
        onTimeRate,
      },
      improvementTargets: this.buildImprovementTargets(contributor),
      trend: this.computeTrend(history),
    };
  }

  private leaderboardSortField(sort: string): string {
    const map: Record<string, string> = {
      reputation: 'reputationScore',
      codeQuality: 'codeQualityScore',
      timeliness: 'timelinessScore',
      communication: 'communicationScore',
      peerFeedback: 'peerFeedbackScore',
    };
    return map[sort] ?? 'reputationScore';
  }
}

// ── Utility functions ─────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
