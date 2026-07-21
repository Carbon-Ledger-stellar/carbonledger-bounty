import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CoreMetricsDto,
  TrendAnalysisDto,
  TrendPoint,
  TrendWindow,
  RetentionDto,
  CohortRow,
  PaymentDistributionDto,
  DistributionBucket,
  SnapshotSummaryDto,
} from './analytics.dto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toYM(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Gini coefficient for an array of non-negative values (0=equal, 1=maximal). */
function gini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i];
  }
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  if (mean === 0) return 0;
  return numerator / (n * n * mean);
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Core metrics ────────────────────────────────────────────────────────────

  /**
   * Compute current platform metrics.
   * Bounties themselves live in-memory; we rely on BountyApplication /
   * BountyCompletion for analytics.
   */
  async getCoreMetrics(): Promise<CoreMetricsDto> {
    const [
      bountiesOpen,
      applicationsPending,
      completions,
      totalPayoutsAgg,
      uniqueContributors,
    ] = await Promise.all([
      this.prisma.bountyApplication.count({ where: { status: 'pending' } }),
      this.prisma.bountyApplication.count({ where: { status: 'pending' } }),
      this.prisma.bountyCompletion.findMany(),
      this.prisma.bountyCompletion.aggregate({ _sum: { rewardUsd: true } }),
      this.prisma.bountyCompletion
        .findMany({ distinct: ['contributorId'], select: { contributorId: true } })
        .then(r => r.length),
    ]);

    const totalCompletions = completions.length;
    const totalPayoutsUsd = totalPayoutsAgg._sum.rewardUsd ?? 0;

    // Average time to complete (hours)
    const timings = completions
      .filter(c => c.hoursToComplete != null)
      .map(c => c.hoursToComplete as number);
    const avgTimeToCompleteHours =
      timings.length > 0 ? timings.reduce((s, v) => s + v, 0) / timings.length : null;

    // Completion rate: completions / (completions + rejected)
    const totalClosed = await this.prisma.bountyApplication.count({
      where: { status: { in: ['accepted', 'rejected', 'withdrawn'] } },
    });
    const completionRate = totalClosed > 0 ? totalCompletions / totalClosed : 0;

    // Cost per task
    const costPerTask = totalCompletions > 0 ? totalPayoutsUsd / totalCompletions : null;

    // Avg velocity (completions per day over last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCompletions = await this.prisma.bountyCompletion.count({
      where: { completedAt: { gte: thirtyDaysAgo } },
    });
    const avgVelocityHours = recentCompletions > 0 ? (30 * 24) / recentCompletions : null;

    return {
      bountiesOpen,
      applicationsPending,
      avgVelocityHours,
      completionRate: Math.round(completionRate * 1000) / 10, // percent with 1dp
      avgTimeToCompleteHours: avgTimeToCompleteHours != null
        ? Math.round(avgTimeToCompleteHours * 10) / 10
        : null,
      costPerTask: costPerTask != null ? Math.round(costPerTask * 100) / 100 : null,
      totalCompletions,
      totalPayoutsUsd: Math.round(totalPayoutsUsd * 100) / 100,
      uniqueContributors,
      computedAt: new Date().toISOString(),
    };
  }

  // ── Trend analysis ──────────────────────────────────────────────────────────

  async getTrendAnalysis(window: TrendWindow = '30d'): Promise<TrendAnalysisDto> {
    const days = window === '7d' ? 7 : window === '30d' ? 30 : 90;
    const now = new Date();
    const windowStart = startOfDay(addDays(now, -days));

    // Fetch completions and applications in window
    const [completionsInWindow, applicationsInWindow] = await Promise.all([
      this.prisma.bountyCompletion.findMany({
        where: { completedAt: { gte: windowStart } },
        select: { completedAt: true, hoursToComplete: true },
      }),
      this.prisma.bountyApplication.findMany({
        where: { appliedAt: { gte: windowStart }, status: 'pending' },
        select: { appliedAt: true },
      }),
    ]);

    // Build per-day buckets
    const dayBuckets = new Map<string, { completions: number; pending: number; velocities: number[] }>();
    for (let i = 0; i < days; i++) {
      const day = toYMD(addDays(windowStart, i));
      dayBuckets.set(day, { completions: 0, pending: 0, velocities: [] });
    }

    for (const c of completionsInWindow) {
      const day = toYMD(c.completedAt);
      const bucket = dayBuckets.get(day);
      if (bucket) {
        bucket.completions++;
        if (c.hoursToComplete != null) bucket.velocities.push(c.hoursToComplete);
      }
    }
    for (const a of applicationsInWindow) {
      const day = toYMD(a.appliedAt);
      const bucket = dayBuckets.get(day);
      if (bucket) bucket.pending++;
    }

    // Snapshot the open-bounties count from latest snapshot (or 0)
    const latestSnapshot = await this.prisma.analyticsSnapshot.findFirst({
      orderBy: { snapshotAt: 'desc' },
    });
    const currentOpen = latestSnapshot?.bountiesOpen ?? 0;

    const points: TrendPoint[] = Array.from(dayBuckets.entries()).map(([date, b]) => ({
      date,
      bountiesOpen: currentOpen,
      completions: b.completions,
      applicationsPending: b.pending,
      avgVelocityHours:
        b.velocities.length > 0
          ? Math.round((b.velocities.reduce((s, v) => s + v, 0) / b.velocities.length) * 10) / 10
          : null,
    }));

    // Acceleration: compare first half vs second half completion counts
    const half = Math.floor(days / 2);
    const firstHalfPts = points.slice(0, half);
    const secondHalfPts = points.slice(half);
    const firstHalfAvg =
      firstHalfPts.reduce((s, p) => s + p.completions, 0) / (firstHalfPts.length || 1);
    const secondHalfAvg =
      secondHalfPts.reduce((s, p) => s + p.completions, 0) / (secondHalfPts.length || 1);

    const growthPct =
      firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

    let completionVelocityTrend: 'accelerating' | 'decelerating' | 'stable';
    if (growthPct > 5) completionVelocityTrend = 'accelerating';
    else if (growthPct < -5) completionVelocityTrend = 'decelerating';
    else completionVelocityTrend = 'stable';

    // Comparison across all three windows
    const comparison = await this.buildWindowComparison();

    return {
      window,
      points,
      completionVelocityTrend,
      completionGrowthPct: Math.round(growthPct * 10) / 10,
      previousWindowAvgCompletions: Math.round(firstHalfAvg * 100) / 100,
      currentWindowAvgCompletions: Math.round(secondHalfAvg * 100) / 100,
      comparison,
    };
  }

  private async buildWindowComparison() {
    const buildWindowStats = async (days: number) => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const completions = await this.prisma.bountyCompletion.findMany({
        where: { completedAt: { gte: since } },
        select: { hoursToComplete: true },
      });
      const timings = completions
        .filter(c => c.hoursToComplete != null)
        .map(c => c.hoursToComplete as number);
      const avgVelocity =
        timings.length > 0 ? Math.round((timings.reduce((s, v) => s + v, 0) / timings.length) * 10) / 10 : null;
      return { completions: completions.length, avgVelocity };
    };

    const [d7, d30, d90] = await Promise.all([
      buildWindowStats(7),
      buildWindowStats(30),
      buildWindowStats(90),
    ]);

    return { '7d': d7, '30d': d30, '90d': d90 };
  }

  // ── Contributor retention ────────────────────────────────────────────────────

  async getRetentionCohorts(): Promise<RetentionDto> {
    // Load all completions ordered by contributor + date
    const allCompletions = await this.prisma.bountyCompletion.findMany({
      select: { contributorId: true, completedAt: true },
      orderBy: [{ contributorId: 'asc' }, { completedAt: 'asc' }],
    });

    // Group by contributor
    const byContributor = new Map<string, Date[]>();
    for (const c of allCompletions) {
      const dates = byContributor.get(c.contributorId) ?? [];
      dates.push(c.completedAt);
      byContributor.set(c.contributorId, dates);
    }

    // Group contributors by their first-completion month (cohort)
    const cohortMap = new Map<
      string,
      { first: Date; hasSecond: boolean; hasThird: boolean }[]
    >();

    for (const [, dates] of byContributor.entries()) {
      const firstDate = dates[0];
      const month = toYM(firstDate);
      const entry = {
        first: firstDate,
        hasSecond: dates.length >= 2,
        hasThird: dates.length >= 3,
      };
      const arr = cohortMap.get(month) ?? [];
      arr.push(entry);
      cohortMap.set(month, arr);
    }

    const cohorts: CohortRow[] = Array.from(cohortMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohortMonth, contributors]) => {
        const n = contributors.length;
        const returnedFor2nd = contributors.filter(c => c.hasSecond).length;
        const returnedFor3rd = contributors.filter(c => c.hasThird).length;
        return {
          cohortMonth,
          contributorsInCohort: n,
          returnedFor2nd,
          returnedFor2ndPct: n > 0 ? Math.round((returnedFor2nd / n) * 1000) / 10 : 0,
          returnedFor3rd,
          returnedFor3rdPct: n > 0 ? Math.round((returnedFor3rd / n) * 1000) / 10 : 0,
        };
      });

    // Overall retention across all cohorts
    const totalContributors = [...byContributor.values()].length;
    const returnedFor2nd = [...byContributor.values()].filter(d => d.length >= 2).length;
    const returnedFor3rd = [...byContributor.values()].filter(d => d.length >= 3).length;

    return {
      cohorts,
      overallRetentionFor2nd:
        totalContributors > 0 ? Math.round((returnedFor2nd / totalContributors) * 1000) / 10 : 0,
      overallRetentionFor3rd:
        totalContributors > 0 ? Math.round((returnedFor3rd / totalContributors) * 1000) / 10 : 0,
    };
  }

  // ── Payment distribution ─────────────────────────────────────────────────────

  async getPaymentDistribution(): Promise<PaymentDistributionDto> {
    const completions = await this.prisma.bountyCompletion.findMany({
      select: { contributorId: true, rewardUsd: true },
    });

    // Aggregate per contributor
    const byContributor = new Map<string, { earned: number; completions: number }>();
    let totalPayout = 0;
    for (const c of completions) {
      const entry = byContributor.get(c.contributorId) ?? { earned: 0, completions: 0 };
      entry.earned += c.rewardUsd;
      entry.completions++;
      byContributor.set(c.contributorId, entry);
      totalPayout += c.rewardUsd;
    }

    const contributors = Array.from(byContributor.entries())
      .sort(([, a], [, b]) => b.earned - a.earned);

    const totalContributors = contributors.length;
    const top20Count = Math.max(1, Math.ceil(totalContributors * 0.2));
    const top20Earnings = contributors
      .slice(0, top20Count)
      .reduce((s, [, v]) => s + v.earned, 0);

    const top20Pct = totalPayout > 0 ? (top20Earnings / totalPayout) * 100 : 0;

    const buckets: DistributionBucket[] = contributors
      .slice(0, 20)
      .map(([contributorId, v], i) => ({
        rank: i + 1,
        contributorId,
        totalEarnedUsd: Math.round(v.earned * 100) / 100,
        completions: v.completions,
        pctOfTotalPayout: totalPayout > 0 ? Math.round((v.earned / totalPayout) * 1000) / 10 : 0,
      }));

    const allEarnings = contributors.map(([, v]) => v.earned);

    return {
      topPercentile: 20,
      topPercentileEarningsPct: Math.round(top20Pct * 10) / 10,
      totalPayoutsUsd: Math.round(totalPayout * 100) / 100,
      totalContributors,
      buckets,
      giniCoefficient: Math.round(gini(allEarnings) * 1000) / 1000,
    };
  }

  // ── Hourly snapshot ──────────────────────────────────────────────────────────

  /**
   * Compute and persist an analytics snapshot.
   * Called by the scheduler every hour.
   */
  async computeAndSaveSnapshot(): Promise<SnapshotSummaryDto> {
    const metrics = await this.getCoreMetrics();

    const [totalBountiesEver, totalCompletionsEver, uniqueContributors] = await Promise.all([
      this.prisma.bountyApplication.count(),
      this.prisma.bountyCompletion.count(),
      this.prisma.bountyCompletion
        .findMany({ distinct: ['contributorId'], select: { contributorId: true } })
        .then(r => r.length),
    ]);

    const snapshot = await this.prisma.analyticsSnapshot.create({
      data: {
        bountiesOpen: metrics.bountiesOpen,
        bountiesCompleted: metrics.totalCompletions,
        bountiesCancelled: 0,
        applicationsPending: metrics.applicationsPending,
        applicationsTotal: totalBountiesEver,
        avgTimeToCompleteHours: metrics.avgTimeToCompleteHours,
        completionRate: metrics.completionRate,
        costPerTask: metrics.costPerTask,
        totalBountiesEver,
        totalCompletionsEver,
        totalPayoutsUsd: metrics.totalPayoutsUsd,
        uniqueContributorsEver: uniqueContributors,
      },
    });

    this.logger.log(`Analytics snapshot saved: ${snapshot.id} at ${snapshot.snapshotAt.toISOString()}`);

    return this.mapSnapshot(snapshot);
  }

  /** List recent snapshots (for sparklines, health checks). */
  async getRecentSnapshots(limit = 48): Promise<SnapshotSummaryDto[]> {
    const rows = await this.prisma.analyticsSnapshot.findMany({
      orderBy: { snapshotAt: 'desc' },
      take: limit,
    });
    return rows.map(r => this.mapSnapshot(r));
  }

  // ── Report data ─────────────────────────────────────────────────────────────

  /**
   * Aggregate data for weekly / monthly / quarterly stakeholder reports.
   * Returns all metrics needed to render or export a report.
   */
  async getReportData(period: 'weekly' | 'monthly' | 'quarterly', endDate?: Date) {
    const end = endDate ?? new Date();
    const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 : 90;
    const start = addDays(end, -days);

    const [completions, applications, retention, distribution] = await Promise.all([
      this.prisma.bountyCompletion.findMany({
        where: { completedAt: { gte: start, lte: end } },
      }),
      this.prisma.bountyApplication.findMany({
        where: { appliedAt: { gte: start, lte: end } },
      }),
      this.getRetentionCohorts(),
      this.getPaymentDistribution(),
    ]);

    const totalPaid = completions.reduce((s, c) => s + c.rewardUsd, 0);
    const timings = completions
      .filter(c => c.hoursToComplete != null)
      .map(c => c.hoursToComplete as number);
    const avgTime =
      timings.length > 0 ? timings.reduce((s, v) => s + v, 0) / timings.length : null;

    return {
      period,
      start: start.toISOString(),
      end: end.toISOString(),
      completions: completions.length,
      applications: applications.length,
      totalPaidUsd: Math.round(totalPaid * 100) / 100,
      avgTimeToCompleteHours: avgTime != null ? Math.round(avgTime * 10) / 10 : null,
      costPerTask: completions.length > 0 ? Math.round((totalPaid / completions.length) * 100) / 100 : null,
      retention,
      distribution,
      completionRows: completions,
      applicationRows: applications,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private mapSnapshot(s: {
    snapshotAt: Date;
    bountiesOpen: number;
    bountiesCompleted: number;
    applicationsPending: number;
    avgTimeToCompleteHours: number | null;
    completionRate: number | null;
    costPerTask: number | null;
    totalPayoutsUsd: number;
    uniqueContributorsEver: number;
  }): SnapshotSummaryDto {
    return {
      snapshotAt: s.snapshotAt.toISOString(),
      bountiesOpen: s.bountiesOpen,
      bountiesCompleted: s.bountiesCompleted,
      applicationsPending: s.applicationsPending,
      avgTimeToCompleteHours: s.avgTimeToCompleteHours,
      completionRate: s.completionRate,
      costPerTask: s.costPerTask,
      totalPayoutsUsd: s.totalPayoutsUsd,
      uniqueContributorsEver: s.uniqueContributorsEver,
    };
  }
}
