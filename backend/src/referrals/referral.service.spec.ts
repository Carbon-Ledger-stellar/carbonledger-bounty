import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReferralService } from './referral.service';
import { PrismaService } from '../prisma.service';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeContributor(overrides: Partial<any> = {}): any {
  return {
    id: 'contrib-1',
    userId: 'user-1',
    referralCode: 'TESTCODE',
    referredById: null,
    bountiesCompleted: 0,
    totalBonusEarned: 0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

function makeBonus(overrides: Partial<any> = {}): any {
  return {
    id: 'bonus-1',
    referrerId: 'contrib-referrer',
    referredId: 'contrib-1',
    bountyId: 'bounty-1',
    bountyAmountUsd: 1000,
    bonusAmountUsd: 50,
    bountyNumber: 1,
    status: 'PENDING',
    createdAt: new Date(),
    paidAt: null,
    ...overrides,
  };
}

// ── Mock PrismaService factory ────────────────────────────────────────────

function buildPrismaMock() {
  return {
    user: { findUnique: jest.fn() },
    contributor: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    referralBonus: {
      create: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    referralMilestone: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

// ── Test suite ────────────────────────────────────────────────────────────

describe('ReferralService', () => {
  let service: ReferralService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
  });

  // ── registerContributor ─────────────────────────────────────────────────

  describe('registerContributor', () => {
    it('creates a contributor for a valid user with no referral code', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.contributor.findUnique
        .mockResolvedValueOnce(null)  // no existing contributor
        .mockResolvedValueOnce(null); // code uniqueness check
      const created = makeContributor();
      prisma.contributor.create.mockResolvedValue(created);

      const result = await service.registerContributor({ userId: 'user-1' });

      expect(prisma.contributor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1', referredById: null }),
        }),
      );
      expect(result).toEqual(created);
    });

    it('links referrer when a valid referral code is supplied', async () => {
      const referrer = makeContributor({ id: 'referrer-id', userId: 'user-referrer', referralCode: 'REFCODE1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prisma.contributor.findUnique
        .mockResolvedValueOnce(null)       // no existing for userId
        .mockResolvedValueOnce(referrer)   // look-up referral code
        .mockResolvedValueOnce(null);      // code uniqueness check
      const created = makeContributor({ id: 'contrib-2', userId: 'user-2', referredById: 'referrer-id' });
      prisma.contributor.create.mockResolvedValue(created);

      const result = await service.registerContributor({ userId: 'user-2', referralCode: 'REFCODE1' });

      expect(prisma.contributor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ referredById: 'referrer-id' }),
        }),
      );
      expect(result.referredById).toBe('referrer-id');
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.registerContributor({ userId: 'ghost-user' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when contributor already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.contributor.findUnique.mockResolvedValueOnce(makeContributor());

      await expect(
        service.registerContributor({ userId: 'user-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for invalid referral code', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.contributor.findUnique
        .mockResolvedValueOnce(null)  // no existing contributor
        .mockResolvedValueOnce(null); // referral code lookup → not found

      await expect(
        service.registerContributor({ userId: 'user-1', referralCode: 'BADCODE' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when contributor tries to use their own referral code', async () => {
      const self = makeContributor({ id: 'self-id', userId: 'user-1', referralCode: 'SELFCODE' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.contributor.findUnique
        .mockResolvedValueOnce(null)  // no existing contributor record
        .mockResolvedValueOnce(self); // code resolves to self

      await expect(
        service.registerContributor({ userId: 'user-1', referralCode: 'SELFCODE' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── onBountyCompleted ───────────────────────────────────────────────────

  describe('onBountyCompleted', () => {
    const dto = { contributorId: 'contrib-1', bountyId: 'bounty-1', bountyAmountUsd: 1000 };

    it('returns null when contributor has no referrer', async () => {
      const contributor = makeContributor({ referredById: null });
      prisma.contributor.findUnique.mockResolvedValue({ ...contributor, referredBy: null });
      prisma.contributor.update.mockResolvedValue({ ...contributor, bountiesCompleted: 1 });

      const result = await service.onBountyCompleted(dto);

      expect(result).toBeNull();
      expect(prisma.referralBonus.create).not.toHaveBeenCalled();
    });

    it('creates a 5% bonus for the first bounty completion', async () => {
      const referrer = makeContributor({ id: 'referrer-id', totalBonusEarned: 0 });
      const contributor = makeContributor({ id: 'contrib-1', referredById: 'referrer-id', referredBy: referrer });

      prisma.contributor.findUnique
        .mockResolvedValueOnce({ ...contributor, referredBy: referrer }) // initial fetch
        .mockResolvedValueOnce(null)    // ring detection: contrib-1 ancestry (referrer has no referredById)
        .mockResolvedValueOnce(referrer); // referrer fetch for cap check

      prisma.contributor.update.mockResolvedValue({ ...contributor, bountiesCompleted: 1 });
      prisma.referralBonus.count.mockResolvedValue(0); // no previous bonuses
      // Ring detection: walk up referrer's chain — referrer has no referredById
      prisma.contributor.findUnique
        .mockResolvedValueOnce({ ...contributor, referredBy: referrer })
        .mockResolvedValueOnce(referrer) // referrer fetch in ring detection
        .mockResolvedValueOnce(referrer); // referrer fetch for cap check

      const bonus = makeBonus({ bonusAmountUsd: 50 });
      prisma.$transaction.mockResolvedValue([bonus, referrer]);
      prisma.contributor.count.mockResolvedValue(1); // milestone check: total referrals
      prisma.referralMilestone.findUnique.mockResolvedValue(null); // no milestone yet (1 < 5)
      // threshold 5 not met, so no milestone creation

      // Reset and set up clean mocks
      jest.clearAllMocks();

      const contributor2 = makeContributor({ id: 'contrib-1', referredById: 'referrer-id', referredBy: referrer });
      prisma.contributor.findUnique
        .mockResolvedValueOnce({ ...contributor2, referredBy: referrer }) // main fetch with include
        .mockResolvedValueOnce(referrer)   // ring walk: referrer's referredById is null → stop
        .mockResolvedValueOnce(referrer);  // referrer cap check

      prisma.contributor.update.mockResolvedValue({ ...contributor2, bountiesCompleted: 1 });
      prisma.referralBonus.count.mockResolvedValue(0);
      prisma.$transaction.mockResolvedValue([bonus, referrer]);
      prisma.contributor.count.mockResolvedValue(1);
      // No milestones reached (1 referral < 5)

      const result = await service.onBountyCompleted(dto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(bonus);
    });

    it('returns null when contributor has already completed 3 bonus bounties', async () => {
      const referrer = makeContributor({ id: 'referrer-id' });
      const contributor = makeContributor({ referredById: 'referrer-id', referredBy: referrer });

      prisma.contributor.findUnique.mockResolvedValue({ ...contributor, referredBy: referrer });
      prisma.contributor.update.mockResolvedValue(contributor);
      prisma.referralBonus.count.mockResolvedValue(3); // max reached

      const result = await service.onBountyCompleted(dto);

      expect(result).toBeNull();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('caps bonus at the remaining $500 allowance', async () => {
      const referrer = makeContributor({ id: 'referrer-id', totalBonusEarned: 490 }); // $10 left
      const contributor = makeContributor({ referredById: 'referrer-id', referredBy: referrer });

      prisma.contributor.findUnique
        .mockResolvedValueOnce({ ...contributor, referredBy: referrer })
        .mockResolvedValueOnce(referrer)  // ring walk
        .mockResolvedValueOnce(referrer); // cap check

      prisma.contributor.update.mockResolvedValue(contributor);
      prisma.referralBonus.count.mockResolvedValue(1); // one previous bonus

      const cappedBonus = makeBonus({ bonusAmountUsd: 10 }); // capped to $10 remaining
      prisma.$transaction.mockResolvedValue([cappedBonus, referrer]);
      prisma.contributor.count.mockResolvedValue(1);

      const result = await service.onBountyCompleted(dto);

      // $1000 * 5% = $50, but only $10 remaining → capped at $10
      const transactionCall = prisma.$transaction.mock.calls[0][0];
      // The createBonus data is the first call in the transaction array
      expect(result).toEqual(cappedBonus);
    });

    it('returns null when referrer has hit the $500 cap', async () => {
      const referrer = makeContributor({ id: 'referrer-id', totalBonusEarned: 500 });
      const contributor = makeContributor({ referredById: 'referrer-id', referredBy: referrer });

      prisma.contributor.findUnique
        .mockResolvedValueOnce({ ...contributor, referredBy: referrer })
        .mockResolvedValueOnce(referrer)  // ring walk
        .mockResolvedValueOnce(referrer); // cap check

      prisma.contributor.update.mockResolvedValue(contributor);
      prisma.referralBonus.count.mockResolvedValue(0);

      const result = await service.onBountyCompleted(dto);

      expect(result).toBeNull();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when contributor does not exist', async () => {
      prisma.contributor.findUnique.mockResolvedValue(null);

      await expect(service.onBountyCompleted(dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getReferralStats ────────────────────────────────────────────────────

  describe('getReferralStats', () => {
    it('returns stats for a valid contributor', async () => {
      const contributor = makeContributor({ totalBonusEarned: 150 });
      prisma.contributor.findUnique.mockResolvedValue(contributor);
      prisma.contributor.count.mockResolvedValue(3);
      prisma.contributor.findMany.mockResolvedValue([
        { bountiesCompleted: 2 },
        { bountiesCompleted: 0 },
        { bountiesCompleted: 1 },
      ]);
      prisma.referralBonus.aggregate.mockResolvedValue({ _sum: { bonusAmountUsd: 25 } });
      prisma.referralMilestone.findMany.mockResolvedValue([]);

      const stats = await service.getReferralStats('contrib-1');

      expect(stats.totalReferrals).toBe(3);
      expect(stats.activeReferrals).toBe(2); // two have bountiesCompleted >= 1
      expect(stats.paidBonusUsd).toBe(150);
      expect(stats.pendingBonusUsd).toBe(25);
    });

    it('throws NotFoundException for unknown contributor', async () => {
      prisma.contributor.findUnique.mockResolvedValue(null);

      await expect(service.getReferralStats('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getCohortAnalysis ───────────────────────────────────────────────────

  describe('getCohortAnalysis', () => {
    it('groups referred contributors by month and referrer', async () => {
      const jan = new Date('2025-01-15');
      const feb = new Date('2025-02-10');

      prisma.contributor.findMany.mockResolvedValue([
        { id: 'c1', referredById: 'ref-1', bountiesCompleted: 1, createdAt: jan },
        { id: 'c2', referredById: 'ref-1', bountiesCompleted: 0, createdAt: jan },
        { id: 'c3', referredById: 'ref-1', bountiesCompleted: 2, createdAt: feb },
      ]);

      const rows = await service.getCohortAnalysis({});

      expect(rows).toHaveLength(2);
      const janRow = rows.find(r => r.cohortMonth === '2025-01')!;
      expect(janRow.totalReferred).toBe(2);
      expect(janRow.completedAtLeastOne).toBe(1);
      expect(janRow.retentionRate).toBe(0.5);
    });

    it('returns empty array when no referred contributors found', async () => {
      prisma.contributor.findMany.mockResolvedValue([]);

      const rows = await service.getCohortAnalysis({});

      expect(rows).toEqual([]);
    });
  });

  // ── getTopReferrers ─────────────────────────────────────────────────────

  describe('getTopReferrers', () => {
    it('returns contributors sorted by totalBonusEarned', async () => {
      const contributors = [
        makeContributor({ id: 'a', userId: 'ua', referralCode: 'CODEA', totalBonusEarned: 200, _count: { referrals: 5 } }),
        makeContributor({ id: 'b', userId: 'ub', referralCode: 'CODEB', totalBonusEarned: 100, _count: { referrals: 3 } }),
      ];
      prisma.contributor.findMany.mockResolvedValue(contributors);
      prisma.contributor.groupBy.mockResolvedValue([
        { referredById: 'a', _count: { id: 3 } },
      ]);

      const result = await service.getTopReferrers({ limit: 10 });

      expect(result).toHaveLength(2);
      expect(result[0].totalBonusEarnedUsd).toBe(200);
      expect(result[0].activeReferrals).toBe(3);
      expect(result[1].activeReferrals).toBe(0); // b not in groupBy
    });
  });

  // ── getReferralRetentionReport ──────────────────────────────────────────

  describe('getReferralRetentionReport', () => {
    it('compares referred vs organic contributors', async () => {
      prisma.contributor.aggregate
        .mockResolvedValueOnce({ _count: { id: 10 }, _avg: { bountiesCompleted: 2.5, totalBonusEarned: 30 } }) // referred
        .mockResolvedValueOnce({ _count: { id: 20 }, _avg: { bountiesCompleted: 1.2 } }); // organic

      prisma.contributor.count
        .mockResolvedValueOnce(7) // referred active
        .mockResolvedValueOnce(8); // organic active

      const report = await service.getReferralRetentionReport();

      expect(report.referred.total).toBe(10);
      expect(report.referred.active).toBe(7);
      expect(report.referred.retentionRate).toBeCloseTo(0.7);
      expect(report.organic.total).toBe(20);
      expect(report.organic.retentionRate).toBeCloseTo(0.4);
    });
  });

  // ── Milestone checks (via onBountyCompleted side-effect) ────────────────

  describe('milestone checks', () => {
    it('awards a milestone bonus when referrer reaches 5 referrals', async () => {
      const referrer = makeContributor({ id: 'referrer-id', totalBonusEarned: 0 });
      const contributor = makeContributor({ referredById: 'referrer-id', referredBy: referrer });
      const bonus = makeBonus({ bonusAmountUsd: 50 });

      prisma.contributor.findUnique
        .mockResolvedValueOnce({ ...contributor, referredBy: referrer })
        .mockResolvedValueOnce(referrer)  // ring walk
        .mockResolvedValueOnce(referrer); // cap check

      prisma.contributor.update.mockResolvedValue(contributor);
      prisma.referralBonus.count.mockResolvedValue(0);
      prisma.$transaction.mockResolvedValue([bonus, referrer]);

      // Milestone: 5 referrals reached
      prisma.contributor.count.mockResolvedValue(5);
      // threshold=5 not yet awarded
      prisma.referralMilestone.findUnique
        .mockResolvedValueOnce(null)  // 5 threshold: not awarded yet
        .mockResolvedValue(expect.anything()); // 10 and 20 thresholds

      prisma.referralMilestone.create.mockResolvedValue({
        id: 'ms-1',
        contributorId: 'referrer-id',
        milestone: 5,
        bonusAmountUsd: 50,
        status: 'PENDING',
        achievedAt: new Date(),
      });

      await service.onBountyCompleted({
        contributorId: contributor.id,
        bountyId: 'b-99',
        bountyAmountUsd: 500,
      });

      expect(prisma.referralMilestone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ milestone: 5, bonusAmountUsd: 50 }),
        }),
      );
    });
  });
});
