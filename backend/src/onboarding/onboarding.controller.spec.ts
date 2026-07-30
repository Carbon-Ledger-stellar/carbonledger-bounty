import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONTRIBUTOR = 'contrib-stellar-key';
const mockUser = (key = CONTRIBUTOR) => ({ user: { publicKey: key } });

const makeProgressResponse = (overrides: any = {}) => ({
  contributorId: CONTRIBUTOR,
  status: 'not_started',
  completionPct: 0,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  steps: [],
  ...overrides,
});

const makeCertResponse = (overrides: any = {}) => ({
  certificationId: 'cert-12345',
  contributorId: CONTRIBUTOR,
  domain: 'backend',
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  highestScore: 90,
  isValid: true,
  ...overrides,
});

const makeBadgeResponse = (badge = 'first_contribution') => ({
  badgeId: 'badge-12345',
  contributorId: CONTRIBUTOR,
  badge,
  awardedAt: new Date(),
  metadata: null,
});

// ── Test suite ────────────────────────────────────────────────────────────────

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let service: OnboardingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [
        {
          provide: OnboardingService,
          useValue: {
            startOnboarding: jest.fn(),
            getProgress: jest.fn(),
            listProgress: jest.fn(),
            updateStep: jest.fn(),
            listAssessments: jest.fn(),
            submitAssessment: jest.fn(),
            getAttempts: jest.fn(),
            getCertifications: jest.fn(),
            checkCertification: jest.fn(),
            lockBounty: jest.fn(),
            unlockBounty: jest.fn(),
            checkBountyAccess: jest.fn(),
            listLockedBounties: jest.fn(),
            getBadges: jest.fn(),
            recordMentorship: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OnboardingController>(OnboardingController);
    service = module.get<OnboardingService>(OnboardingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── POST /start ────────────────────────────────────────────────────────────

  describe('startOnboarding', () => {
    it('calls service.startOnboarding with the user publicKey', async () => {
      const progress = makeProgressResponse();
      jest.spyOn(service, 'startOnboarding').mockResolvedValue(progress);

      const result = await controller.startOnboarding(mockUser());

      expect(service.startOnboarding).toHaveBeenCalledWith(CONTRIBUTOR);
      expect(result.contributorId).toBe(CONTRIBUTOR);
    });
  });

  // ── GET /progress ──────────────────────────────────────────────────────────

  describe('getMyProgress', () => {
    it('returns the authenticated contributor progress', async () => {
      const progress = makeProgressResponse({ status: 'in_progress', completionPct: 40 });
      jest.spyOn(service, 'getProgress').mockResolvedValue(progress);

      const result = await controller.getMyProgress(mockUser());

      expect(service.getProgress).toHaveBeenCalledWith(CONTRIBUTOR);
      expect(result.completionPct).toBe(40);
    });
  });

  // ── GET /progress/:contributorId ───────────────────────────────────────────

  describe('getProgress (by param)', () => {
    it('returns progress for any contributor ID', async () => {
      const progress = makeProgressResponse({ contributorId: 'other-key' });
      jest.spyOn(service, 'getProgress').mockResolvedValue(progress);

      const result = await controller.getProgress('other-key');

      expect(service.getProgress).toHaveBeenCalledWith('other-key');
      expect(result).toBeDefined();
    });
  });

  // ── GET / (list) ───────────────────────────────────────────────────────────

  describe('listProgress', () => {
    it('passes status filter to service', async () => {
      jest.spyOn(service, 'listProgress').mockResolvedValue([]);

      await controller.listProgress('in_progress');

      expect(service.listProgress).toHaveBeenCalledWith({ status: 'in_progress' });
    });

    it('works without a status filter', async () => {
      jest.spyOn(service, 'listProgress').mockResolvedValue([]);

      await controller.listProgress(undefined);

      expect(service.listProgress).toHaveBeenCalledWith({ status: undefined });
    });
  });

  // ── PUT /steps ─────────────────────────────────────────────────────────────

  describe('updateStep', () => {
    it('calls service with the correct stepKey and status', async () => {
      const progress = makeProgressResponse({ status: 'in_progress', completionPct: 20 });
      jest.spyOn(service, 'updateStep').mockResolvedValue(progress);

      const dto = { stepKey: 'setup' as const, status: 'completed' as const };
      const result = await controller.updateStep(dto, mockUser());

      expect(service.updateStep).toHaveBeenCalledWith(CONTRIBUTOR, dto);
      expect(result).toBeDefined();
    });
  });

  // ── GET /assessments ───────────────────────────────────────────────────────

  describe('listAssessments', () => {
    it('returns all assessments when no domain filter', async () => {
      jest.spyOn(service, 'listAssessments').mockResolvedValue([{ assessmentId: 'a1' }] as any);

      const result = await controller.listAssessments(undefined);

      expect(service.listAssessments).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(1);
    });

    it('passes domain filter to service', async () => {
      jest.spyOn(service, 'listAssessments').mockResolvedValue([]);

      await controller.listAssessments('frontend');

      expect(service.listAssessments).toHaveBeenCalledWith('frontend');
    });
  });

  // ── POST /assessments/submit ────────────────────────────────────────────────

  describe('submitAssessment', () => {
    it('calls service with the contributor publicKey', async () => {
      const dto = {
        assessmentId: 'assess-be-01',
        score: 85,
        startedAt: new Date().toISOString(),
      };
      const response = { attempt: {}, passed: true, certification: makeCertResponse() };
      jest.spyOn(service, 'submitAssessment').mockResolvedValue(response as any);

      const result = await controller.submitAssessment(dto, mockUser());

      expect(service.submitAssessment).toHaveBeenCalledWith(CONTRIBUTOR, dto);
      expect(result.passed).toBe(true);
    });
  });

  // ── GET /assessments/attempts ───────────────────────────────────────────────

  describe('getMyAttempts', () => {
    it('delegates to service with user publicKey', async () => {
      jest.spyOn(service, 'getAttempts').mockResolvedValue([]);

      await controller.getMyAttempts(mockUser());

      expect(service.getAttempts).toHaveBeenCalledWith(CONTRIBUTOR);
    });
  });

  // ── GET /certifications ─────────────────────────────────────────────────────

  describe('getMyCertifications', () => {
    it('returns certifications for the authenticated contributor', async () => {
      const certs = [makeCertResponse()];
      jest.spyOn(service, 'getCertifications').mockResolvedValue(certs as any);

      const result = await controller.getMyCertifications(mockUser());

      expect(service.getCertifications).toHaveBeenCalledWith(CONTRIBUTOR);
      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(true);
    });
  });

  // ── POST /certifications/check ──────────────────────────────────────────────

  describe('checkCertification', () => {
    it('delegates check to service', async () => {
      const dto = { contributorId: CONTRIBUTOR, domain: 'backend' as const };
      jest.spyOn(service, 'checkCertification').mockResolvedValue(makeCertResponse() as any);

      const result = await controller.checkCertification(dto);

      expect(service.checkCertification).toHaveBeenCalledWith(dto);
      expect(result).not.toBeNull();
    });
  });

  // ── POST /locked-bounties ───────────────────────────────────────────────────

  describe('lockBounty', () => {
    it('calls service.lockBounty and returns the lock record', () => {
      jest.spyOn(service, 'lockBounty').mockReturnValue(undefined);

      const result = controller.lockBounty('bounty-hard-1', 'backend');

      expect(service.lockBounty).toHaveBeenCalledWith('bounty-hard-1', 'backend');
      expect(result).toEqual({ bountyId: 'bounty-hard-1', domain: 'backend', locked: true });
    });
  });

  // ── DELETE /locked-bounties/:bountyId ──────────────────────────────────────

  describe('unlockBounty', () => {
    it('calls service.unlockBounty and returns the unlock record', () => {
      jest.spyOn(service, 'unlockBounty').mockReturnValue(undefined);

      const result = controller.unlockBounty('bounty-hard-1');

      expect(service.unlockBounty).toHaveBeenCalledWith('bounty-hard-1');
      expect(result).toEqual({ bountyId: 'bounty-hard-1', locked: false });
    });
  });

  // ── GET /bounty-access/:bountyId ───────────────────────────────────────────

  describe('checkBountyAccess', () => {
    it('returns hasAccess=true for an open bounty', async () => {
      const response = {
        contributorId: CONTRIBUTOR,
        bountyId: 'open-bounty',
        requiresCertification: false,
        domain: null,
        hasAccess: true,
        reason: 'Bounty is open to all contributors.',
      };
      jest.spyOn(service, 'checkBountyAccess').mockResolvedValue(response);

      const result = await controller.checkBountyAccess('open-bounty', mockUser());

      expect(service.checkBountyAccess).toHaveBeenCalledWith('open-bounty', CONTRIBUTOR);
      expect(result.hasAccess).toBe(true);
    });

    it('returns hasAccess=false when certification is missing', async () => {
      const response = {
        contributorId: CONTRIBUTOR,
        bountyId: 'locked-bounty',
        requiresCertification: true,
        domain: 'backend' as const,
        hasAccess: false,
        reason: 'backend certification required.',
      };
      jest.spyOn(service, 'checkBountyAccess').mockResolvedValue(response);

      const result = await controller.checkBountyAccess('locked-bounty', mockUser());

      expect(result.hasAccess).toBe(false);
      expect(result.domain).toBe('backend');
    });
  });

  // ── GET /badges ────────────────────────────────────────────────────────────

  describe('getMyBadges', () => {
    it('returns badges for the authenticated contributor', async () => {
      const badges = [makeBadgeResponse('first_contribution'), makeBadgeResponse('first_certification')];
      jest.spyOn(service, 'getBadges').mockResolvedValue(badges as any);

      const result = await controller.getMyBadges(mockUser());

      expect(service.getBadges).toHaveBeenCalledWith(CONTRIBUTOR);
      expect(result).toHaveLength(2);
    });
  });

  // ── POST /mentorship ───────────────────────────────────────────────────────

  describe('recordMentorship', () => {
    it('calls service.recordMentorship with mentor publicKey', async () => {
      jest.spyOn(service, 'recordMentorship').mockResolvedValue({ menteeCount: 1, badgeAwarded: false });

      const result = await controller.recordMentorship({ menteeId: 'mentee-abc' }, mockUser());

      expect(service.recordMentorship).toHaveBeenCalledWith(CONTRIBUTOR, { menteeId: 'mentee-abc' });
      expect(result.menteeCount).toBe(1);
    });
  });
});
