/**
 * analytics.service.spec.ts
 *
 * Unit tests for AnalyticsService.  PrismaService is fully mocked so no
 * database connection is needed.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCompletion(overrides: Partial<{
  id: string;
  bountyId: string;
  bountyTitle: string;
  contributorId: string;
  rewardUsd: number;
  difficulty: string;
  bountyType: string;
  startedAt: Date;
  completedAt: Date;
  hoursToComplete: number | null;
}> = {}) {
  return {
    id: 'c-' + Math.random(),
    bountyId: 'b-1',
    bountyTitle: 'Test bounty',
    contributorId: 'contrib-1',
    rewardUsd: 500,
    difficulty: 'beginner',
    bountyType: 'backend',
    startedAt: new Date('2024-01-01T08:00:00Z'),
    completedAt: new Date('2024-01-02T08:00:00Z'),
    hoursToComplete: 24,
    ...overrides,
  };
}

function makeApplication(overrides: Partial<{
  id: string;
  bountyId: string;
  bountyTitle: string;
  applicantId: string;
  rewardUsd: number;
  difficulty: string;
  bountyType: string;
  status: string;
  appliedAt: Date;
  acceptedAt: Date | null;
  completedAt: Date | null;
  rejectedAt: Date | null;
}> = {}) {
  return {
    id: 'a-' + Math.random(),
    bountyId: 'b-1',
    bountyTitle: 'Test bounty',
    applicantId: 'contrib-1',
    rewardUsd: 500,
    difficulty: 'beginner',
    bountyType: 'backend',
    status: 'pending',
    appliedAt: new Date(),
    acceptedAt: null,
    completedAt: null,
    rejectedAt: null,
    ...overrides,
  };
}

// ── Mock builder ──────────────────────────────────────────────────────────────

function buildPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    bountyApplication: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { rewardUsd: 0 } }),
    },
    bountyCompletion: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { rewardUsd: 0 } }),
    },
    analyticsSnapshot: {
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...args.data, id: 'snap-1', snapshotAt: new Date() }),
      ),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prismaMock = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  // ── getCoreMetrics ──────────────────────────────────────────────────────────

  describe('getCoreMetrics', () => {
    it('returns zero metrics when database is empty', async () => {
      const result = await service.getCoreMetrics();

      expect(result.bountiesOpen).toBe(0);
      expect(result.applicationsPending).toBe(0);
      expect(result.totalCompletions).toBe(0);
      expect(result.totalPayoutsUsd).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.avgTimeToCompleteHours).toBeNull();
      expect(result.costPerTask).toBeNull();
      expect(result.computedAt).toBeDefined();
    });

    it('calculates average time to complete correctly', async () => {
      const completions = [
        makeCompletion({ hoursToComplete: 10 }),
        makeCompletion({ hoursToComplete: 20 }),
        makeCompletion({ hoursToComplete: 30 }),
      ];
      prismaMock.bountyCompletion.findMany.mockResolvedValue(completions);
      prismaMock.bountyCompletion.aggregate.mockResolvedValue({ _sum: { rewardUsd: 1500 } });
      prismaMock.bountyCompletion.count.mockResolvedValue(3);

      const result = await service.getCoreMetrics();

      expect(result.avgTimeToCompleteHours).toBe(20); // (10+20+30)/3
    });

    it('calculates cost per task correctly', async () => {
      const completions = [
        makeCompletion({ rewardUsd: 300 }),
        makeCompletion({ rewardUsd: 700 }),
      ];
      prismaMock.bountyCompletion.findMany.mockResolvedValue(completions);
      prismaMock.bountyCompletion.aggregate.mockResolvedValue({ _sum: { rewardUsd: 1000 } });
      prismaMock.bountyCompletion.count.mockResolvedValue(2);

      const result = await service.getCoreMetrics();

      expect(result.costPerTask).toBe(500);
    });

    it('skips null hoursToComplete values', async () => {
      const completions = [
        makeCompletion({ hoursToComplete: null }),
        makeCompletion({ hoursToComplete: 40 }),
      ];
      prismaMock.bountyCompletion.findMany.mockResolvedValue(completions);

      const result = await service.getCoreMetrics();

      expect(result.avgTimeToCompleteHours).toBe(40);
    });
  });

  // ── getRetentionCohorts ─────────────────────────────────────────────────────

  describe('getRetentionCohorts', () => {
    it('returns empty cohorts when no completions', async () => {
      const result = await service.getRetentionCohorts();
      expect(result.cohorts).toHaveLength(0);
      expect(result.overallRetentionFor2nd).toBe(0);
      expect(result.overallRetentionFor3rd).toBe(0);
    });

    it('correctly calculates single-bounty contributor retention', async () => {
      // 2 contributors: one did 1 bounty, one did 2
      const completions = [
        { contributorId: 'alice', completedAt: new Date('2024-01-15') },
        { contributorId: 'bob',   completedAt: new Date('2024-01-10') },
        { contributorId: 'bob',   completedAt: new Date('2024-02-05') },
      ];
      prismaMock.bountyCompletion.findMany.mockResolvedValue(completions);

      const result = await service.getRetentionCohorts();

      // Overall: 1 of 2 returned for 2nd = 50%
      expect(result.overallRetentionFor2nd).toBe(50);
      expect(result.overallRetentionFor3rd).toBe(0);
    });

    it('correctly groups contributors into monthly cohorts', async () => {
      const completions = [
        { contributorId: 'alice', completedAt: new Date('2024-01-05') },
        { contributorId: 'alice', completedAt: new Date('2024-02-10') }, // returns
        { contributorId: 'bob',   completedAt: new Date('2024-01-20') },
        // bob does not return
      ];
      prismaMock.bountyCompletion.findMany.mockResolvedValue(completions);

      const result = await service.getRetentionCohorts();

      // Both alice and bob are in the 2024-01 cohort
      const jan = result.cohorts.find(c => c.cohortMonth === '2024-01');
      expect(jan).toBeDefined();
      expect(jan!.contributorsInCohort).toBe(2);
      expect(jan!.returnedFor2nd).toBe(1);
      expect(jan!.returnedFor2ndPct).toBe(50);
    });
  });

  // ── getPaymentDistribution ──────────────────────────────────────────────────

  describe('getPaymentDistribution', () => {
    it('returns zeros when no completions', async () => {
      const result = await service.getPaymentDistribution();
      expect(result.totalPayoutsUsd).toBe(0);
      expect(result.totalContributors).toBe(0);
      expect(result.buckets).toHaveLength(0);
      expect(result.giniCoefficient).toBe(0);
    });

    it('top 20% earner share is 100% when there is one contributor', async () => {
      prismaMock.bountyCompletion.findMany.mockResolvedValue([
        makeCompletion({ contributorId: 'solo', rewardUsd: 1000 }),
        makeCompletion({ contributorId: 'solo', rewardUsd: 500 }),
      ]);

      const result = await service.getPaymentDistribution();

      expect(result.topPercentileEarningsPct).toBe(100);
      expect(result.totalContributors).toBe(1);
    });

    it('gini coefficient is 0 for equal distribution', async () => {
      // 3 contributors, each earns exactly the same
      prismaMock.bountyCompletion.findMany.mockResolvedValue([
        makeCompletion({ contributorId: 'a', rewardUsd: 100 }),
        makeCompletion({ contributorId: 'b', rewardUsd: 100 }),
        makeCompletion({ contributorId: 'c', rewardUsd: 100 }),
      ]);

      const result = await service.getPaymentDistribution();

      expect(result.giniCoefficient).toBe(0);
    });

    it('top-20% earning share is computed correctly for 5 contributors', async () => {
      // contributor 'top' earns 800, the other 4 each earn 50 → total 1000
      // top 20% (ceil 5*0.2 = 1) earns 800/1000 = 80%
      prismaMock.bountyCompletion.findMany.mockResolvedValue([
        makeCompletion({ contributorId: 'top', rewardUsd: 800 }),
        makeCompletion({ contributorId: 'b',   rewardUsd: 50 }),
        makeCompletion({ contributorId: 'c',   rewardUsd: 50 }),
        makeCompletion({ contributorId: 'd',   rewardUsd: 50 }),
        makeCompletion({ contributorId: 'e',   rewardUsd: 50 }),
      ]);

      const result = await service.getPaymentDistribution();

      expect(result.topPercentileEarningsPct).toBe(80);
    });
  });

  // ── getTrendAnalysis ────────────────────────────────────────────────────────

  describe('getTrendAnalysis', () => {
    it('returns correct window label', async () => {
      const result = await service.getTrendAnalysis('7d');
      expect(result.window).toBe('7d');
      expect(result.points).toHaveLength(7);
    });

    it('returns 30 points for 30d window', async () => {
      const result = await service.getTrendAnalysis('30d');
      expect(result.points).toHaveLength(30);
    });

    it('returns 90 points for 90d window', async () => {
      const result = await service.getTrendAnalysis('90d');
      expect(result.points).toHaveLength(90);
    });

    it('marks trend as stable when there is no activity', async () => {
      const result = await service.getTrendAnalysis('30d');
      expect(result.completionVelocityTrend).toBe('stable');
      expect(result.completionGrowthPct).toBe(0);
    });
  });

  // ── computeAndSaveSnapshot ──────────────────────────────────────────────────

  describe('computeAndSaveSnapshot', () => {
    it('persists a snapshot and returns summary DTO', async () => {
      const snapshot = await service.computeAndSaveSnapshot();

      expect(prismaMock.analyticsSnapshot.create).toHaveBeenCalledTimes(1);
      expect(snapshot.snapshotAt).toBeDefined();
      expect(snapshot.bountiesOpen).toBe(0);
    });
  });
});
