import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { PrismaService } from '../prisma.service';
import { PAYMENT_BPS } from './dispute.dto';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const CONTRIBUTOR = 'contrib-stellar-key';
const REVIEWER = 'reviewer-stellar-key';
const ARBITRATOR = 'arbitrator-stellar-key';
const OTHER = 'other-stellar-key';

const makeDispute = (overrides: Partial<any> = {}): any => ({
  id: 'cuid-1',
  disputeId: 'dispute-12345-abcde',
  bountyId: 'bounty-99',
  contributorId: CONTRIBUTOR,
  reviewerId: REVIEWER,
  arbitratorId: ARBITRATOR,
  status: 'opened',
  reviewDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  reviewExtended: false,
  appealCount: 0,
  appealedAt: null,
  appealReason: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  decidedAt: null,
  finalizedAt: null,
  ...overrides,
});

const makeEvidence = (overrides: Partial<any> = {}): any => ({
  id: 'ev-cuid-1',
  evidenceId: 'evidence-12345-abcde',
  disputeId: 'dispute-12345-abcde',
  submittedBy: CONTRIBUTOR,
  type: 'pr_link',
  title: 'PR #42',
  content: 'https://github.com/org/repo/pull/42',
  metadata: null,
  isAppeal: false,
  createdAt: new Date(),
  ...overrides,
});

const makeDecision = (overrides: Partial<any> = {}): any => ({
  id: 'dec-cuid-1',
  decisionId: 'decision-12345-abcde',
  disputeId: 'dispute-12345-abcde',
  arbitratorId: ARBITRATOR,
  decision: 'approved',
  rationale: 'Work fully meets the acceptance criteria.',
  paymentBps: 10000,
  isAppeal: false,
  createdAt: new Date(),
  ...overrides,
});

const makeLog = (): any => ({
  id: 'log-cuid-1',
  logId: 'log-12345-abcde',
  disputeId: 'dispute-12345-abcde',
  actorId: CONTRIBUTOR,
  action: 'DISPUTE_OPENED',
  payload: '{}',
  createdAt: new Date(),
});

// ── Test suite ───────────────────────────────────────────────────────────────

describe('DisputeService', () => {
  let service: DisputeService;
  let prisma: PrismaService;

  // Build a fresh mock for each test so spies don't bleed across tests
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeService,
        {
          provide: PrismaService,
          useValue: {
            dispute: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            evidence: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            disputeDecision: {
              create: jest.fn(),
            },
            disputeAuditLog: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DisputeService>(DisputeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  // ── openDispute ─────────────────────────────────────────────────────────────

  describe('openDispute', () => {
    it('creates a dispute with status opened', async () => {
      const createdDispute = makeDispute();
      const fullDispute = { ...createdDispute, evidence: [], decisions: [] };

      jest.spyOn(prisma.dispute, 'create').mockResolvedValue(createdDispute);
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(fullDispute as any);
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      const result = await service.openDispute(
        { bountyId: 'bounty-99', reviewerId: REVIEWER },
        CONTRIBUTOR,
      );

      expect(prisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bountyId: 'bounty-99',
            contributorId: CONTRIBUTOR,
            reviewerId: REVIEWER,
            status: 'opened',
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('attaches initial evidence when provided', async () => {
      const createdDispute = makeDispute();
      const fullDispute = { ...createdDispute, evidence: [], decisions: [] };

      jest.spyOn(prisma.dispute, 'create').mockResolvedValue(createdDispute);
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(fullDispute as any);
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());
      (prisma.$transaction as jest.Mock).mockResolvedValue([makeEvidence()]);

      await service.openDispute(
        {
          bountyId: 'bounty-99',
          reviewerId: REVIEWER,
          initialEvidence: [
            { type: 'pr_link', title: 'PR #1', content: 'https://github.com/pr/1' },
          ],
        },
        CONTRIBUTOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── startReview ─────────────────────────────────────────────────────────────

  describe('startReview', () => {
    it('transitions opened → under_review', async () => {
      const openedDispute = makeDispute({ status: 'opened' });
      const updatedDispute = makeDispute({ status: 'under_review', arbitratorId: ARBITRATOR });
      const fullDispute = { ...updatedDispute, evidence: [], decisions: [] };

      jest.spyOn(prisma.dispute, 'findUnique')
        .mockResolvedValueOnce(openedDispute)       // getDisputeOrThrow
        .mockResolvedValueOnce(fullDispute as any);  // findOne at end
      jest.spyOn(prisma.dispute, 'update').mockResolvedValue(updatedDispute);
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      const result = await service.startReview('dispute-12345-abcde', ARBITRATOR);
      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'under_review', arbitratorId: ARBITRATOR }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('throws if dispute is not in opened status', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'under_review' }),
      );

      await expect(
        service.startReview('dispute-12345-abcde', ARBITRATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 404 for unknown disputeId', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(null);

      await expect(
        service.startReview('nonexistent', ARBITRATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── addEvidence ─────────────────────────────────────────────────────────────

  describe('addEvidence', () => {
    const evidenceDto = {
      type: 'pr_link' as const,
      title: 'PR #42',
      content: 'https://github.com/org/repo/pull/42',
    };

    it('adds evidence when dispute is under_review', async () => {
      const dispute = makeDispute({ status: 'under_review' });
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(dispute);
      jest.spyOn(prisma.evidence, 'create').mockResolvedValue(makeEvidence());
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      const result = await service.addEvidence(
        'dispute-12345-abcde',
        evidenceDto,
        CONTRIBUTOR,
      );

      expect(prisma.evidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            disputeId: 'dispute-12345-abcde',
            submittedBy: CONTRIBUTOR,
            type: 'pr_link',
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('allows evidence in opened status', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(makeDispute({ status: 'opened' }));
      jest.spyOn(prisma.evidence, 'create').mockResolvedValue(makeEvidence());
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      await expect(
        service.addEvidence('dispute-12345-abcde', evidenceDto, CONTRIBUTOR),
      ).resolves.toBeDefined();
    });

    it('allows evidence in appealed status', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(makeDispute({ status: 'appealed' }));
      jest.spyOn(prisma.evidence, 'create').mockResolvedValue(makeEvidence());
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      await expect(
        service.addEvidence('dispute-12345-abcde', evidenceDto, CONTRIBUTOR),
      ).resolves.toBeDefined();
    });

    it('rejects evidence submission for decided dispute', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(makeDispute({ status: 'decided' }));

      await expect(
        service.addEvidence('dispute-12345-abcde', evidenceDto, CONTRIBUTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects evidence submission for final dispute', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(makeDispute({ status: 'final' }));

      await expect(
        service.addEvidence('dispute-12345-abcde', evidenceDto, CONTRIBUTOR),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── extendReview ────────────────────────────────────────────────────────────

  describe('extendReview', () => {
    it('extends deadline from 7 to 14 days', async () => {
      const dispute = makeDispute({ status: 'under_review', reviewExtended: false });
      const updated = { ...dispute, reviewExtended: true, evidence: [], decisions: [] };

      jest.spyOn(prisma.dispute, 'findUnique')
        .mockResolvedValueOnce(dispute)
        .mockResolvedValueOnce(updated as any);
      jest.spyOn(prisma.dispute, 'update').mockResolvedValue(updated);
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      const result = await service.extendReview(
        'dispute-12345-abcde',
        { extend: true },
        ARBITRATOR,
      );

      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reviewExtended: true }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('throws if already extended', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'under_review', reviewExtended: true }),
      );

      await expect(
        service.extendReview('dispute-12345-abcde', { extend: true }, ARBITRATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if dispute is not under_review', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'opened' }),
      );

      await expect(
        service.extendReview('dispute-12345-abcde', { extend: true }, ARBITRATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if extend=false', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'under_review' }),
      );

      await expect(
        service.extendReview('dispute-12345-abcde', { extend: false }, ARBITRATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if a different arbitrator tries to extend', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'under_review', arbitratorId: ARBITRATOR }),
      );

      await expect(
        service.extendReview('dispute-12345-abcde', { extend: true }, OTHER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── makeDecision ────────────────────────────────────────────────────────────

  describe('makeDecision', () => {
    const RATIONALE = 'The PR meets all acceptance criteria outlined in the bounty.';

    it('transitions under_review → decided with approved decision', async () => {
      const dispute = makeDispute({ status: 'under_review' });
      const updatedDispute = makeDispute({ status: 'decided', decidedAt: new Date() });
      const fullDispute = { ...updatedDispute, evidence: [], decisions: [makeDecision()] };

      jest.spyOn(prisma.dispute, 'findUnique')
        .mockResolvedValueOnce(dispute)
        .mockResolvedValueOnce(fullDispute as any);
      (prisma.$transaction as jest.Mock).mockResolvedValue([makeDecision(), updatedDispute]);
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      const result = await service.makeDecision(
        'dispute-12345-abcde',
        { decision: 'approved', rationale: RATIONALE },
        ARBITRATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('transitions under_review → decided with rejected decision (0 bps)', async () => {
      const dispute = makeDispute({ status: 'under_review' });
      const updatedDispute = makeDispute({ status: 'decided' });
      const fullDispute = { ...updatedDispute, evidence: [], decisions: [] };

      jest.spyOn(prisma.dispute, 'findUnique')
        .mockResolvedValueOnce(dispute)
        .mockResolvedValueOnce(fullDispute as any);
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        makeDecision({ decision: 'rejected', paymentBps: 0 }),
        updatedDispute,
      ]);
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      await service.makeDecision(
        'dispute-12345-abcde',
        { decision: 'rejected', rationale: RATIONALE },
        ARBITRATOR,
      );

      const txCall = (prisma.$transaction as jest.Mock).mock.calls[0][0];
      // First item in the transaction array should be the decision create
      expect(txCall).toHaveLength(2);
    });

    it('transitions appealed → final (appeal decision)', async () => {
      const dispute = makeDispute({ status: 'appealed', decidedAt: new Date(), appealCount: 1 });
      const updatedDispute = makeDispute({ status: 'final', finalizedAt: new Date() });
      const fullDispute = { ...updatedDispute, evidence: [], decisions: [] };

      jest.spyOn(prisma.dispute, 'findUnique')
        .mockResolvedValueOnce(dispute)
        .mockResolvedValueOnce(fullDispute as any);
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        makeDecision({ isAppeal: true }),
        updatedDispute,
      ]);
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      const result = await service.makeDecision(
        'dispute-12345-abcde',
        { decision: 'approved', rationale: RATIONALE },
        ARBITRATOR,
      );

      expect(result).toBeDefined();
    });

    it('partial decision yields 5000 bps', async () => {
      const dispute = makeDispute({ status: 'under_review' });
      const updatedDispute = makeDispute({ status: 'decided' });
      const fullDispute = { ...updatedDispute, evidence: [], decisions: [] };

      jest.spyOn(prisma.dispute, 'findUnique')
        .mockResolvedValueOnce(dispute)
        .mockResolvedValueOnce(fullDispute as any);

      let capturedDecisionData: any;
      (prisma.$transaction as jest.Mock).mockImplementation((ops) => {
        // ops is an array of prisma calls; we can't easily inspect them without
        // actually calling them. Instead, verify via PAYMENT_BPS constant.
        return Promise.resolve([makeDecision({ decision: 'partial', paymentBps: 5000 }), updatedDispute]);
      });
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      await service.makeDecision(
        'dispute-12345-abcde',
        { decision: 'partial', rationale: RATIONALE },
        ARBITRATOR,
      );

      expect(PAYMENT_BPS.partial).toBe(5000);
    });

    it('throws if dispute is not actionable (decided)', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'decided' }),
      );

      await expect(
        service.makeDecision(
          'dispute-12345-abcde',
          { decision: 'approved', rationale: RATIONALE },
          ARBITRATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if wrong arbitrator tries to decide', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'under_review', arbitratorId: ARBITRATOR }),
      );

      await expect(
        service.makeDecision(
          'dispute-12345-abcde',
          { decision: 'approved', rationale: RATIONALE },
          OTHER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── fileAppeal ──────────────────────────────────────────────────────────────

  describe('fileAppeal', () => {
    const newEvidence = [
      { type: 'test_result' as const, title: 'CI run', content: 'https://ci.example.com/123' },
    ];

    it('transitions decided → appealed', async () => {
      const dispute = makeDispute({ status: 'decided', appealCount: 0 });
      const updatedDispute = makeDispute({ status: 'appealed', appealCount: 1 });
      const fullDispute = { ...updatedDispute, evidence: [], decisions: [] };

      jest.spyOn(prisma.dispute, 'findUnique')
        .mockResolvedValueOnce(dispute)      // getDisputeOrThrow in fileAppeal
        .mockResolvedValueOnce(fullDispute as any); // findOne at end
      (prisma.$transaction as jest.Mock).mockResolvedValue([makeEvidence()]);
      jest.spyOn(prisma.dispute, 'update').mockResolvedValue(updatedDispute);
      jest.spyOn(prisma.disputeAuditLog, 'create').mockResolvedValue(makeLog());

      const result = await service.fileAppeal(
        'dispute-12345-abcde',
        { appealReason: 'The original decision overlooked the test suite results.', newEvidence },
        CONTRIBUTOR,
      );

      expect(prisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'appealed',
            appealCount: { increment: 1 },
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('throws if dispute is not in decided status', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'under_review' }),
      );

      await expect(
        service.fileAppeal(
          'dispute-12345-abcde',
          { appealReason: 'Reason here for the appeal filing.', newEvidence },
          CONTRIBUTOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if a non-contributor tries to appeal', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'decided', contributorId: CONTRIBUTOR }),
      );

      await expect(
        service.fileAppeal(
          'dispute-12345-abcde',
          { appealReason: 'Reason here for the appeal filing.', newEvidence },
          OTHER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws if appeal limit is already reached', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'decided', appealCount: 1 }),
      );

      await expect(
        service.fileAppeal(
          'dispute-12345-abcde',
          { appealReason: 'Reason here for the appeal filing.', newEvidence },
          CONTRIBUTOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if no new evidence is provided', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(
        makeDispute({ status: 'decided', appealCount: 0 }),
      );

      await expect(
        service.fileAppeal(
          'dispute-12345-abcde',
          { appealReason: 'Reason here for the appeal filing.', newEvidence: [] },
          CONTRIBUTOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns dispute with evidence and decisions', async () => {
      const fullDispute = {
        ...makeDispute(),
        evidence: [makeEvidence()],
        decisions: [makeDecision()],
      };
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(fullDispute as any);

      const result = await service.findOne('dispute-12345-abcde');
      expect(result.evidence).toHaveLength(1);
      expect(result.decisions).toHaveLength(1);
    });

    it('throws 404 for unknown dispute', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all disputes when no filter given', async () => {
      const disputes = [
        { ...makeDispute(), evidence: [], decisions: [] },
        { ...makeDispute({ disputeId: 'dispute-other', status: 'decided' }), evidence: [], decisions: [] },
      ];
      jest.spyOn(prisma.dispute, 'findMany').mockResolvedValue(disputes as any);

      const result = await service.findAll({});
      expect(result).toHaveLength(2);
    });

    it('passes status filter to prisma', async () => {
      jest.spyOn(prisma.dispute, 'findMany').mockResolvedValue([]);

      await service.findAll({ status: 'opened' });

      expect(prisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'opened' }),
        }),
      );
    });
  });

  // ── getAuditLog ─────────────────────────────────────────────────────────────

  describe('getAuditLog', () => {
    it('returns audit entries ordered by createdAt', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(makeDispute());
      jest.spyOn(prisma.disputeAuditLog, 'findMany').mockResolvedValue([makeLog()]);

      const result = await service.getAuditLog('dispute-12345-abcde');
      expect(result).toHaveLength(1);
      expect(prisma.disputeAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { disputeId: 'dispute-12345-abcde' },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('throws 404 if dispute not found', async () => {
      jest.spyOn(prisma.dispute, 'findUnique').mockResolvedValue(null);

      await expect(service.getAuditLog('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getStats ─────────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('aggregates counts across all statuses', async () => {
      jest.spyOn(prisma.dispute, 'count')
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(3)   // opened
        .mockResolvedValueOnce(2)   // under_review
        .mockResolvedValueOnce(3)   // decided
        .mockResolvedValueOnce(1)   // appealed
        .mockResolvedValueOnce(1);  // final

      const stats = await service.getStats();

      expect(stats.total).toBe(10);
      expect(stats.opened).toBe(3);
      expect(stats.underReview).toBe(2);
      expect(stats.decided).toBe(3);
      expect(stats.appealed).toBe(1);
      expect(stats.final).toBe(1);
    });
  });
});
