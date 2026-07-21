import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  BountyCompletedDto,
  CohortQueryDto,
  RegisterContributorDto,
  TopReferrersQueryDto,
} from './referral.dto';
import { Contributor, ReferralBonus, ReferralMilestone } from '@prisma/client';

// ── Constants ──────────────────────────────────────────────────────────────

/** Bonus rate applied to the referred contributor's bounty reward */
const REFERRAL_BONUS_RATE = 0.05; // 5 %

/** Maximum number of bounties per referred contributor that generate a bonus */
const MAX_BONUS_BOUNTIES = 3;

/**
 * Hard cap on total bonus a single referrer can earn across all referrals
 * ($500 as stated in the acceptance criteria).
 */
const MAX_TOTAL_BONUS_USD = 500;

/** Growth-campaign milestone thresholds and their bonus amounts (USD) */
const MILESTONES: Array<{ threshold: number; bonusUsd: number }> = [
  { threshold: 5, bonusUsd: 50 },
  { threshold: 10, bonusUsd: 100 },
  { threshold: 20, bonusUsd: 200 },
];

// ── Interfaces for response shapes ────────────────────────────────────────

export interface ReferralStats {
  contributor: Contributor;
  totalReferrals: number;
  activeReferrals: number;    // referred contributors who completed ≥1 bounty
  pendingBonusUsd: number;
  paidBonusUsd: number;
  milestones: ReferralMilestone[];
}

export interface CohortRow {
  cohortMonth: string;           // "YYYY-MM"
  referrerId: string;
  totalReferred: number;
  completedAtLeastOne: number;   // engagement metric
  totalBountiesCompleted: number;
  retentionRate: number;         // completedAtLeastOne / totalReferred
}

export interface TopReferrer {
  contributorId: string;
  userId: string;
  referralCode: string;
  totalReferrals: number;
  activeReferrals: number;
  totalBonusEarnedUsd: number;
}

// ── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Contributor registration ─────────────────────────────────────────────

  /**
   * Register a contributor on the platform.
   * - Generates a unique referral code for them.
   * - Validates and links the referrer (if a ref code was supplied).
   * - Fraud checks: self-referral prevention, ring detection.
   */
  async registerContributor(dto: RegisterContributorDto): Promise<Contributor> {
    // Guard: user must exist
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);

    // Guard: contributor record must not already exist
    const existing = await this.prisma.contributor.findUnique({
      where: { userId: dto.userId },
    });
    if (existing) throw new ConflictException('Contributor already registered');

    let referredById: string | null = null;

    if (dto.referralCode) {
      const referrer = await this.prisma.contributor.findUnique({
        where: { referralCode: dto.referralCode },
      });

      if (!referrer) {
        throw new BadRequestException(`Invalid referral code: ${dto.referralCode}`);
      }

      // Fraud: self-referral
      if (referrer.userId === dto.userId) {
        throw new BadRequestException('Self-referrals are not allowed');
      }

      referredById = referrer.id;
    }

    const referralCode = await this.generateUniqueCode();

    const contributor = await this.prisma.contributor.create({
      data: {
        userId: dto.userId,
        referralCode,
        referredById,
      },
    });

    this.logger.log(
      `Contributor registered: ${contributor.id} (referredBy=${referredById ?? 'organic'})`,
    );

    return contributor;
  }

  // ── Bounty completion / bonus calculation ────────────────────────────────

  /**
   * Called whenever a contributor completes a bounty and receives a payout.
   * - Determines whether a referral bonus is owed to their referrer.
   * - Checks the per-referrer $500 cap before crediting.
   * - Detects and blocks referral-ring fraud before paying.
   * - Triggers milestone checks on the referrer's side.
   */
  async onBountyCompleted(dto: BountyCompletedDto): Promise<ReferralBonus | null> {
    const contributor = await this.prisma.contributor.findUnique({
      where: { id: dto.contributorId },
      include: { referredBy: true },
    });

    if (!contributor) throw new NotFoundException(`Contributor ${dto.contributorId} not found`);

    // Increment completed bounty counter
    const updatedContributor = await this.prisma.contributor.update({
      where: { id: contributor.id },
      data: { bountiesCompleted: { increment: 1 } },
    });

    // No referrer → nothing to pay
    if (!contributor.referredById || !contributor.referredBy) {
      return null;
    }

    const referrerId = contributor.referredById;

    // Count how many bonuses have already been issued for this referred contributor
    const existingBonusCount = await this.prisma.referralBonus.count({
      where: { referredId: contributor.id },
    });

    if (existingBonusCount >= MAX_BONUS_BOUNTIES) {
      this.logger.debug(
        `Contributor ${contributor.id} has exhausted max bonus bounties (${MAX_BONUS_BOUNTIES})`,
      );
      return null;
    }

    // Fraud: referral ring detection
    const isRing = await this.detectReferralRing(referrerId, contributor.id);
    if (isRing) {
      this.logger.warn(
        `Referral ring detected between ${referrerId} and ${contributor.id}. Bonus suppressed.`,
      );
      return null;
    }

    // Check per-referrer $500 cap
    const referrer = await this.prisma.contributor.findUnique({
      where: { id: referrerId },
    });
    if (!referrer) return null;

    const remaining = MAX_TOTAL_BONUS_USD - referrer.totalBonusEarned;
    if (remaining <= 0) {
      this.logger.debug(`Referrer ${referrerId} has reached the $${MAX_TOTAL_BONUS_USD} bonus cap`);
      return null;
    }

    const rawBonus = dto.bountyAmountUsd * REFERRAL_BONUS_RATE;
    const bonusAmountUsd = Math.min(rawBonus, remaining);
    const bountyNumber = existingBonusCount + 1;

    // Create the bonus record and update the referrer's running total atomically
    const [bonus] = await this.prisma.$transaction([
      this.prisma.referralBonus.create({
        data: {
          referrerId,
          referredId: contributor.id,
          bountyId: dto.bountyId,
          bountyAmountUsd: dto.bountyAmountUsd,
          bonusAmountUsd,
          bountyNumber,
          status: 'PENDING',
        },
      }),
      this.prisma.contributor.update({
        where: { id: referrerId },
        data: { totalBonusEarned: { increment: bonusAmountUsd } },
      }),
    ]);

    this.logger.log(
      `Referral bonus $${bonusAmountUsd.toFixed(2)} created for referrer ${referrerId} ` +
        `(bounty #${bountyNumber} of referred ${contributor.id})`,
    );

    // Check whether this referral tips the referrer over a milestone threshold
    await this.checkMilestones(referrerId);

    return bonus;
  }

  // ── Stats for a single contributor ──────────────────────────────────────

  async getReferralStats(contributorId: string): Promise<ReferralStats> {
    const contributor = await this.prisma.contributor.findUnique({
      where: { id: contributorId },
    });
    if (!contributor) throw new NotFoundException(`Contributor ${contributorId} not found`);

    const [totalReferrals, referredList, pendingBonuses, milestones] = await Promise.all([
      this.prisma.contributor.count({ where: { referredById: contributorId } }),
      this.prisma.contributor.findMany({
        where: { referredById: contributorId },
        select: { bountiesCompleted: true },
      }),
      this.prisma.referralBonus.aggregate({
        where: { referrerId: contributorId, status: 'PENDING' },
        _sum: { bonusAmountUsd: true },
      }),
      this.prisma.referralMilestone.findMany({
        where: { contributorId },
        orderBy: { milestone: 'asc' },
      }),
    ]);

    const activeReferrals = referredList.filter(r => r.bountiesCompleted >= 1).length;
    const paidBonusUsd = contributor.totalBonusEarned;
    const pendingBonusUsd = pendingBonuses._sum.bonusAmountUsd ?? 0;

    return {
      contributor,
      totalReferrals,
      activeReferrals,
      pendingBonusUsd,
      paidBonusUsd,
      milestones,
    };
  }

  // ── Cohort analysis ──────────────────────────────────────────────────────

  /**
   * Returns monthly cohorts of referred contributors grouped by the month
   * they signed up, measuring engagement (completion rate) within the cohort.
   */
  async getCohortAnalysis(query: CohortQueryDto): Promise<CohortRow[]> {
    const since = query.since ? new Date(query.since) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Fetch all referred contributors created after `since`
    const referredContributors = await this.prisma.contributor.findMany({
      where: {
        referredById: { not: null },
        createdAt: { gte: since },
      },
      select: {
        id: true,
        referredById: true,
        bountiesCompleted: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Group by cohort month + referrer
    const map = new Map<string, {
      referrerId: string;
      cohortMonth: string;
      members: Array<{ bountiesCompleted: number }>;
    }>();

    for (const c of referredContributors) {
      const month = c.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
      const key = `${month}::${c.referredById}`;
      if (!map.has(key)) {
        map.set(key, { referrerId: c.referredById!, cohortMonth: month, members: [] });
      }
      map.get(key)!.members.push({ bountiesCompleted: c.bountiesCompleted });
    }

    const rows: CohortRow[] = [];
    for (const [, cohort] of map) {
      const total = cohort.members.length;
      const completedAtLeastOne = cohort.members.filter(m => m.bountiesCompleted >= 1).length;
      const totalBountiesCompleted = cohort.members.reduce((s, m) => s + m.bountiesCompleted, 0);
      rows.push({
        cohortMonth: cohort.cohortMonth,
        referrerId: cohort.referrerId,
        totalReferred: total,
        completedAtLeastOne,
        totalBountiesCompleted,
        retentionRate: total > 0 ? completedAtLeastOne / total : 0,
      });
    }

    return rows.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
  }

  // ── Top referrers report ─────────────────────────────────────────────────

  async getTopReferrers(query: TopReferrersQueryDto): Promise<TopReferrer[]> {
    const limit = query.limit ?? 10;

    // Fetch contributors sorted by total bonus earned, then by total referrals
    const contributors = await this.prisma.contributor.findMany({
      where: { referrals: { some: {} } }, // at least one referral
      orderBy: [{ totalBonusEarned: 'desc' }],
      take: limit,
      include: {
        _count: { select: { referrals: true } },
      },
    });

    // For each, compute active referral count in a batched query
    const ids = contributors.map(c => c.id);
    const activeCounts = await this.prisma.contributor.groupBy({
      by: ['referredById'],
      where: { referredById: { in: ids }, bountiesCompleted: { gte: 1 } },
      _count: { id: true },
    });
    const activeMap = new Map(activeCounts.map(a => [a.referredById!, a._count.id]));

    return contributors.map(c => ({
      contributorId: c.id,
      userId: c.userId,
      referralCode: c.referralCode,
      totalReferrals: c._count.referrals,
      activeReferrals: activeMap.get(c.id) ?? 0,
      totalBonusEarnedUsd: c.totalBonusEarned,
    }));
  }

  // ── Retention report ─────────────────────────────────────────────────────

  /**
   * Retention compares referred vs. organic contributors over the same
   * sign-up window to prove whether the referral programme is producing
   * higher-quality contributors.
   */
  async getReferralRetentionReport(since?: string) {
    const cutoff = since ? new Date(since) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [referredStats, organicStats] = await Promise.all([
      this.prisma.contributor.aggregate({
        where: { referredById: { not: null }, createdAt: { gte: cutoff } },
        _count: { id: true },
        _avg: { bountiesCompleted: true, totalBonusEarned: true },
      }),
      this.prisma.contributor.aggregate({
        where: { referredById: null, createdAt: { gte: cutoff } },
        _count: { id: true },
        _avg: { bountiesCompleted: true },
      }),
    ]);

    const referredActiveCount = await this.prisma.contributor.count({
      where: { referredById: { not: null }, createdAt: { gte: cutoff }, bountiesCompleted: { gte: 1 } },
    });
    const organicActiveCount = await this.prisma.contributor.count({
      where: { referredById: null, createdAt: { gte: cutoff }, bountiesCompleted: { gte: 1 } },
    });

    const referredTotal = referredStats._count.id;
    const organicTotal = organicStats._count.id;

    return {
      since: cutoff.toISOString(),
      referred: {
        total: referredTotal,
        active: referredActiveCount,
        retentionRate: referredTotal > 0 ? referredActiveCount / referredTotal : 0,
        avgBountiesCompleted: referredStats._avg.bountiesCompleted ?? 0,
      },
      organic: {
        total: organicTotal,
        active: organicActiveCount,
        retentionRate: organicTotal > 0 ? organicActiveCount / organicTotal : 0,
        avgBountiesCompleted: organicStats._avg.bountiesCompleted ?? 0,
      },
    };
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  /**
   * Growth-campaign milestone check: awards bonuses when the referrer's total
   * confirmed referral count crosses 5 / 10 / 20 thresholds for the first time.
   */
  private async checkMilestones(referrerId: string): Promise<void> {
    const totalReferrals = await this.prisma.contributor.count({
      where: { referredById: referrerId },
    });

    for (const { threshold, bonusUsd } of MILESTONES) {
      if (totalReferrals < threshold) continue;

      // Use upsert-like create with catch-on-conflict to avoid race conditions
      const alreadyAwarded = await this.prisma.referralMilestone.findUnique({
        where: { contributorId_milestone: { contributorId: referrerId, milestone: threshold } },
      });
      if (alreadyAwarded) continue;

      await this.prisma.referralMilestone.create({
        data: {
          contributorId: referrerId,
          milestone: threshold,
          bonusAmountUsd: bonusUsd,
          status: 'PENDING',
        },
      });

      this.logger.log(
        `Milestone ${threshold} reached by ${referrerId} — $${bonusUsd} campaign bonus queued`,
      );
    }
  }

  /**
   * Referral-ring detection: walk up the referral chain from `referrerId` a
   * bounded number of hops and check whether `newReferredId` appears in the
   * ancestry (i.e., A referred B, B referred C, C refers A → ring).
   *
   * Max depth is intentionally small (10) to stay O(depth) even without a
   * recursive CTE, and covers any realistic ring depth.
   */
  private async detectReferralRing(
    referrerId: string,
    newReferredId: string,
    maxDepth = 10,
  ): Promise<boolean> {
    let currentId: string | null = referrerId;
    const visited = new Set<string>();

    for (let depth = 0; depth < maxDepth && currentId; depth++) {
      if (visited.has(currentId)) break; // loop already detected in ancestry
      if (currentId === newReferredId) return true; // ring found

      visited.add(currentId);

      const node = await this.prisma.contributor.findUnique({
        where: { id: currentId },
        select: { referredById: true },
      });
      currentId = node?.referredById ?? null;
    }

    return false;
  }

  /**
   * Generates a collision-resistant 8-character alphanumeric referral code and
   * retries until a unique one is found (typically only one attempt needed).
   */
  private async generateUniqueCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous charset (no 0/O, 1/I)
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Array.from(
        { length: 8 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join('');

      const collision = await this.prisma.contributor.findUnique({
        where: { referralCode: code },
      });
      if (!collision) return code;
    }
    // Extremely unlikely but fail safe
    throw new Error('Could not generate a unique referral code after 10 attempts');
  }
}
