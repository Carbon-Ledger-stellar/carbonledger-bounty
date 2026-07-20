import { Test, TestingModule } from '@nestjs/testing';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const CONTRIBUTOR = 'contrib-stellar-key';
const REVIEWER = 'reviewer-stellar-key';
const ARBITRATOR = 'arbitrator-stellar-key';

const mockUser = (key = CONTRIBUTOR) => ({ user: { publicKey: key } });

const makeFullDispute = (overrides: Partial<any> = {}): any => ({
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
  createdAt: new Date(),
  updatedAt: new Date(),
  decidedAt: null,
  finalizedAt: null,
  evidence: [],
  decisions: [],
  ...overrides,
});

// ── Test suite ───────────────────────────────────────────────────────────────

describe('DisputeController', () => {
  let controller: DisputeController;
  let service: DisputeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputeController],
      providers: [
        {
          provide: DisputeService,
          useValue: {
            openDispute: jest.fn(),
            startReview: jest.fn(),
            addEvidence: jest.fn(),
            extendReview: jest.fn(),
            makeDecision: jest.fn(),
            fileAppeal: jest.fn(),
            findOne: jest.fn(),
            findAll: jest.fn(),
            getEvidence: jest.fn(),
            getAuditLog: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DisputeController>(DisputeController);
    service = module.get<DisputeService>(DisputeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── GET / ── listDisputes ──────────────────────────────────────────────────

  describe('listDisputes', () => {
    it('calls findAll with parsed query params', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([makeFullDispute()]);

      const result = await controller.listDisputes('bounty-99', CONTRIBUTOR, undefined, 'opened');

      expect(service.findAll).toHaveBeenCalledWith({
        bountyId: 'bounty-99',
        contributorId: CONTRIBUTOR,
        arbitratorId: undefined,
        status: 'opened',
      });
      expect(result).toHaveLength(1);
    });

    it('passes undefined filters as-is', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([]);

      await controller.listDisputes(undefined, undefined, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith({
        bountyId: undefined,
        contributorId: undefined,
        arbitratorId: undefined,
        status: undefined,
      });
    });
  });

  // ── GET /stats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns stats object from service', async () => {
      const stats = { total: 5, opened: 1, underReview: 1, decided: 2, appealed: 0, final: 1 };
      jest.spyOn(service, 'getStats').mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(service.getStats).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });
  });

  // ── GET /:disputeId ─────────────────────────────────────────────────────────

  describe('getDispute', () => {
    it('returns the dispute from service', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(makeFullDispute());

      const result = await controller.getDispute('dispute-12345-abcde');

      expect(service.findOne).toHaveBeenCalledWith('dispute-12345-abcde');
      expect(result.disputeId).toBe('dispute-12345-abcde');
    });
  });

  // ── GET /:disputeId/evidence ────────────────────────────────────────────────

  describe('getEvidence', () => {
    it('delegates to service.getEvidence', async () => {
      const evidence = [
        {
          evidenceId: 'ev-1',
          disputeId: 'dispute-12345-abcde',
          submittedBy: CONTRIBUTOR,
          type: 'pr_link',
          title: 'PR #42',
          content: 'https://github.com/org/repo/pull/42',
          metadata: null,
          isAppeal: false,
          createdAt: new Date(),
        },
      ];
      jest.spyOn(service, 'getEvidence').mockResolvedValue(evidence as any);

      const result = await controller.getEvidence('dispute-12345-abcde');

      expect(service.getEvidence).toHaveBeenCalledWith('dispute-12345-abcde');
      expect(result).toHaveLength(1);
    });
  });

  // ── GET /:disputeId/audit-log ───────────────────────────────────────────────

  describe('getAuditLog', () => {
    it('delegates to service.getAuditLog', async () => {
      const logs = [
        {
          logId: 'log-1',
          disputeId: 'dispute-12345-abcde',
          actorId: CONTRIBUTOR,
          action: 'DISPUTE_OPENED',
          payload: '{}',
          createdAt: new Date(),
        },
      ];
      jest.spyOn(service, 'getAuditLog').mockResolvedValue(logs as any);

      const result = await controller.getAuditLog('dispute-12345-abcde');

      expect(service.getAuditLog).toHaveBeenCalledWith('dispute-12345-abcde');
      expect(result).toHaveLength(1);
    });
  });

  // ── POST / ── openDispute ──────────────────────────────────────────────────

  describe('openDispute', () => {
    it('passes dto and user publicKey to service.openDispute', async () => {
      const dto = { bountyId: 'bounty-99', reviewerId: REVIEWER };
      jest.spyOn(service, 'openDispute').mockResolvedValue(makeFullDispute());

      const result = await controller.openDispute(dto, mockUser(CONTRIBUTOR));

      expect(service.openDispute).toHaveBeenCalledWith(dto, CONTRIBUTOR);
      expect(result.status).toBe('opened');
    });
  });

  // ── PUT /:disputeId/start-review ────────────────────────────────────────────

  describe('startReview', () => {
    it('passes disputeId and user publicKey to service.startReview', async () => {
      jest.spyOn(service, 'startReview').mockResolvedValue(
        makeFullDispute({ status: 'under_review', arbitratorId: ARBITRATOR }),
      );

      const result = await controller.startReview('dispute-12345-abcde', mockUser(ARBITRATOR));

      expect(service.startReview).toHaveBeenCalledWith('dispute-12345-abcde', ARBITRATOR);
      expect(result.status).toBe('under_review');
    });
  });

  // ── POST /:disputeId/evidence ───────────────────────────────────────────────

  describe('addEvidence', () => {
    it('delegates to service.addEvidence with user publicKey', async () => {
      const dto = {
        type: 'pr_link' as const,
        title: 'PR #42',
        content: 'https://github.com/org/repo/pull/42',
      };
      const evidence = {
        evidenceId: 'ev-1',
        disputeId: 'dispute-12345-abcde',
        submittedBy: CONTRIBUTOR,
        type: 'pr_link',
        title: 'PR #42',
        content: 'https://github.com/org/repo/pull/42',
        metadata: null,
        isAppeal: false,
        createdAt: new Date(),
      };
      jest.spyOn(service, 'addEvidence').mockResolvedValue(evidence as any);

      const result = await controller.addEvidence(
        'dispute-12345-abcde',
        dto,
        mockUser(CONTRIBUTOR),
      );

      expect(service.addEvidence).toHaveBeenCalledWith(
        'dispute-12345-abcde',
        dto,
        CONTRIBUTOR,
      );
      expect(result).toBeDefined();
    });
  });

  // ── PUT /:disputeId/extend-review ───────────────────────────────────────────

  describe('extendReview', () => {
    it('delegates to service.extendReview', async () => {
      const extended = makeFullDispute({ status: 'under_review', reviewExtended: true });
      jest.spyOn(service, 'extendReview').mockResolvedValue(extended);

      const result = await controller.extendReview(
        'dispute-12345-abcde',
        { extend: true },
        mockUser(ARBITRATOR),
      );

      expect(service.extendReview).toHaveBeenCalledWith(
        'dispute-12345-abcde',
        { extend: true },
        ARBITRATOR,
      );
      expect(result.reviewExtended).toBe(true);
    });
  });

  // ── POST /:disputeId/decision ───────────────────────────────────────────────

  describe('makeDecision', () => {
    it('delegates to service.makeDecision', async () => {
      const decided = makeFullDispute({ status: 'decided' });
      jest.spyOn(service, 'makeDecision').mockResolvedValue(decided);

      const dto = {
        decision: 'approved' as const,
        rationale: 'Work fully meets the acceptance criteria outlined in the bounty.',
      };

      const result = await controller.makeDecision(
        'dispute-12345-abcde',
        dto,
        mockUser(ARBITRATOR),
      );

      expect(service.makeDecision).toHaveBeenCalledWith(
        'dispute-12345-abcde',
        dto,
        ARBITRATOR,
      );
      expect(result.status).toBe('decided');
    });
  });

  // ── POST /:disputeId/appeal ─────────────────────────────────────────────────

  describe('fileAppeal', () => {
    it('delegates to service.fileAppeal with user publicKey', async () => {
      const appealed = makeFullDispute({ status: 'appealed', appealCount: 1 });
      jest.spyOn(service, 'fileAppeal').mockResolvedValue(appealed);

      const dto = {
        appealReason: 'The original decision did not consider the passing CI results.',
        newEvidence: [
          { type: 'test_result' as const, title: 'CI run #55', content: 'https://ci.example.com/55' },
        ],
      };

      const result = await controller.fileAppeal(
        'dispute-12345-abcde',
        dto,
        mockUser(CONTRIBUTOR),
      );

      expect(service.fileAppeal).toHaveBeenCalledWith(
        'dispute-12345-abcde',
        dto,
        CONTRIBUTOR,
      );
      expect(result.status).toBe('appealed');
      expect(result.appealCount).toBe(1);
    });
  });
});
