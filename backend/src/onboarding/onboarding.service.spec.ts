import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../prisma.service';
import {
  PASS_SCORE,
  STEP_KEYS,
  ONBOARDING_STEPS,
  ASSESSMENT_DEFINITIONS,
  MENTOR_THRESHOLD,
} from './onboarding.dto';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CONTRIBUTOR = 'contrib-stellar-key';

const makeSteps = (status = 'not_started') =>
  ONBOARDING_STEPS.map((s, i) => ({
    id: `step-id-${i}`,
    progressId: 'prog-id-1',
    stepKey: s.stepKey,
    title: s.title,
    description: s.description,
    status,
    completedAt: status === 'completed' ? new Date() : null,
    durationMs: status === 'completed' ? 3000 : null,
  }));

const makeProgress = (overrides: any = {}) => ({
  id: 'prog-id-1',
  contributorId: CONTRIBUTOR,
  status: 'not_started',
  completedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  steps: makeSteps(),
  ...overrides,
});

const makeAssessment = (overrides: any = {}) => ({
  id: 'assess-cuid',
  assessmentId: 'assess-be-01',
  domain: 'backend',
  title: 'NestJS Architecture Quiz',
  description: 'Tests knowledge of modules, guards, and Prisma.',
  maxScore: 100,
  passingScore: PASS_SCORE,
  createdAt: new Date(),
  ...overrides,
});

const makeCert = (overrides: any = {}) => ({
  id: 'cert-cuid',
  certificationId: 'cert-12345-abcde',
  contributorId: CONTRIBUTOR,
  domain: 'backend',
  issuedAt: new Date(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  highestScore: 90,
  ...overrides,
});

const makeBadge = (badge = 'first_contribution') => ({
  id: 'badge-cuid',
  badgeId: 'badge-12345-abcde',
  contributorId: CONTRIBUTOR,
  badge,
  awardedAt: new Date(),
  metadata: null,
});

// ── Test suite ────────────────────────────────────────────────────────────────

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: PrismaService,
          useValue: {
            onboardingProgress: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            onboardingStep: {
              update: jest.fn(),
            },
            skillAssessment: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              upsert: jest.fn(),
            },
            assessmentAttempt: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            certification: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            contributorBadge: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  // ── startOnboarding ────────────────────────────────────────────────────────

  describe('startOnboarding', () => {
    it('creates a new progress record with 5 steps when none exists', async () => {
      const created = makeProgress();
      jest.spyOn(prisma.onboardingProgress, 'findUnique').mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(prisma));
      jest.spyOn(prisma.onboardingProgress, 'create').mockResolvedValue(created as any);

      const result = await service.startOnboarding(CONTRIBUTOR);

      expect(prisma.onboardingProgress.create).toHaveBeenCalled();
      expect(result.contributorId).toBe(CONTRIBUTOR);
      expect(result.steps).toHaveLength(STEP_KEYS.length);
      expect(result.completionPct).toBe(0);
    });

    it('returns existing record without creating a new one', async () => {
      const existing = makeProgress({ status: 'in_progress' });
      jest.spyOn(prisma.onboardingProgress, 'findUnique').mockResolvedValue(existing as any);

      const result = await service.startOnboarding(CONTRIBUTOR);

      expect(prisma.onboardingProgress.create).not.toHaveBeenCalled();
      expect(result.status).toBe('in_progress');
    });
  });

  // ── getProgress ────────────────────────────────────────────────────────────

  describe('getProgress', () => {
    it('returns formatted progress with correct completionPct', async () => {
      const threeComplete = makeProgress({
        steps: [
          ...makeSteps('completed').slice(0, 3),
          ...makeSteps('not_started').slice(3),
        ],
      });
      jest.spyOn(prisma.onboardingProgress, 'findUnique').mockResolvedValue(threeComplete as any);

      const result = await service.getProgress(CONTRIBUTOR);

      expect(result.completionPct).toBe(60); // 3/5
    });

    it('throws NotFoundException when no record exists', async () => {
      jest.spyOn(prisma.onboardingProgress, 'findUnique').mockResolvedValue(null);

      await expect(service.getProgress(CONTRIBUTOR)).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateStep ─────────────────────────────────────────────────────────────

  describe('updateStep', () => {
    it('marks a step as in_progress', async () => {
      const progress = makeProgress();
      jest.spyOn(prisma.onboardingProgress, 'findUnique')
        .mockResolvedValueOnce(progress as any)
        .mockResolvedValueOnce(progress as any);
      jest.spyOn(prisma.onboardingStep, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.onboardingProgress, 'update').mockResolvedValue({} as any);

      await service.updateStep(CONTRIBUTOR, { stepKey: 'setup', status: 'in_progress' });

      expect(prisma.onboardingStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'in_progress' }),
        }),
      );
    });

    it('marks a step as completed and sets completedAt', async () => {
      const progress = makeProgress({ status: 'in_progress' });
      jest.spyOn(prisma.onboardingProgress, 'findUnique')
        .mockResolvedValueOnce(progress as any)
        .mockResolvedValueOnce(progress as any);
      jest.spyOn(prisma.onboardingStep, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.onboardingProgress, 'update').mockResolvedValue({} as any);

      await service.updateStep(CONTRIBUTOR, { stepKey: 'setup', status: 'completed' });

      expect(prisma.onboardingStep.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('awards first_contribution badge when all 5 steps complete', async () => {
      const steps = makeSteps('completed');
      steps[4] = { ...steps[4], status: 'in_progress', completedAt: null };
      const progress = makeProgress({ status: 'in_progress', steps });

      jest.spyOn(prisma.onboardingProgress, 'findUnique')
        .mockResolvedValueOnce(progress as any)
        .mockResolvedValueOnce({ ...progress, status: 'completed', steps: makeSteps('completed') } as any);
      jest.spyOn(prisma.onboardingStep, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.onboardingProgress, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.contributorBadge, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.contributorBadge, 'create').mockResolvedValue(makeBadge() as any);

      await service.updateStep(CONTRIBUTOR, { stepKey: 'code_review', status: 'completed' });

      expect(prisma.contributorBadge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ badge: 'first_contribution' }),
        }),
      );
    });

    it('does not re-award badge if already held', async () => {
      const steps = makeSteps('completed');
      steps[4] = { ...steps[4], status: 'in_progress', completedAt: null };
      const progress = makeProgress({ status: 'in_progress', steps });

      jest.spyOn(prisma.onboardingProgress, 'findUnique')
        .mockResolvedValueOnce(progress as any)
        .mockResolvedValueOnce(progress as any);
      jest.spyOn(prisma.onboardingStep, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.onboardingProgress, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.contributorBadge, 'findUnique').mockResolvedValue(makeBadge() as any);

      await service.updateStep(CONTRIBUTOR, { stepKey: 'code_review', status: 'completed' });

      expect(prisma.contributorBadge.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException for already-completed step', async () => {
      const progress = makeProgress({ steps: makeSteps('completed') });
      jest.spyOn(prisma.onboardingProgress, 'findUnique').mockResolvedValue(progress as any);

      await expect(
        service.updateStep(CONTRIBUTOR, { stepKey: 'setup', status: 'completed' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown contributor', async () => {
      jest.spyOn(prisma.onboardingProgress, 'findUnique').mockResolvedValue(null);

      await expect(
        service.updateStep(CONTRIBUTOR, { stepKey: 'setup', status: 'in_progress' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── submitAssessment ───────────────────────────────────────────────────────

  describe('submitAssessment', () => {
    const validDto = {
      assessmentId: 'assess-be-01',
      score: 90,
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };

    beforeEach(() => {
      jest.spyOn(prisma.skillAssessment, 'upsert').mockResolvedValue({} as any);
    });

    it('records a passing attempt and issues a certification', async () => {
      jest.spyOn(prisma.skillAssessment, 'findUnique').mockResolvedValue(makeAssessment() as any);
      jest.spyOn(prisma.assessmentAttempt, 'create').mockResolvedValue({
        attemptId: 'attempt-1', score: 90, passed: true, startedAt: new Date(), completedAt: new Date(),
      } as any);
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.certification, 'create').mockResolvedValue(makeCert() as any);
      jest.spyOn(prisma.contributorBadge, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.contributorBadge, 'create').mockResolvedValue(makeBadge('first_certification') as any);

      const result = await service.submitAssessment(CONTRIBUTOR, validDto);

      expect(result.passed).toBe(true);
      expect(result.certification).not.toBeNull();
      expect(prisma.certification.create).toHaveBeenCalled();
    });

    it('records a failing attempt and does NOT issue a certification', async () => {
      jest.spyOn(prisma.skillAssessment, 'findUnique').mockResolvedValue(makeAssessment() as any);
      jest.spyOn(prisma.assessmentAttempt, 'create').mockResolvedValue({
        score: 70, passed: false, startedAt: new Date(), completedAt: new Date(),
      } as any);

      const result = await service.submitAssessment(CONTRIBUTOR, { ...validDto, score: 70 });

      expect(result.passed).toBe(false);
      expect(result.certification).toBeNull();
      expect(prisma.certification.create).not.toHaveBeenCalled();
    });

    it('renews and updates highestScore on a better passing attempt', async () => {
      jest.spyOn(prisma.skillAssessment, 'findUnique').mockResolvedValue(makeAssessment() as any);
      jest.spyOn(prisma.assessmentAttempt, 'create').mockResolvedValue({ score: 95, passed: true } as any);
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(makeCert({ highestScore: 85 }) as any);
      jest.spyOn(prisma.certification, 'update').mockResolvedValue(makeCert({ highestScore: 95 }) as any);

      const result = await service.submitAssessment(CONTRIBUTOR, { ...validDto, score: 95 });

      expect(prisma.certification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ highestScore: 95 }),
        }),
      );
      expect(result.passed).toBe(true);
    });

    it(`passes at exactly ${PASS_SCORE}`, async () => {
      jest.spyOn(prisma.skillAssessment, 'findUnique').mockResolvedValue(makeAssessment() as any);
      jest.spyOn(prisma.assessmentAttempt, 'create').mockResolvedValue({ score: PASS_SCORE, passed: true } as any);
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.certification, 'create').mockResolvedValue(makeCert() as any);
      jest.spyOn(prisma.contributorBadge, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.contributorBadge, 'create').mockResolvedValue(makeBadge() as any);

      const result = await service.submitAssessment(CONTRIBUTOR, { ...validDto, score: PASS_SCORE });
      expect(result.passed).toBe(true);
    });

    it(`fails at ${PASS_SCORE - 1}`, async () => {
      jest.spyOn(prisma.skillAssessment, 'findUnique').mockResolvedValue(makeAssessment() as any);
      jest.spyOn(prisma.assessmentAttempt, 'create').mockResolvedValue({ score: PASS_SCORE - 1, passed: false } as any);

      const result = await service.submitAssessment(CONTRIBUTOR, { ...validDto, score: PASS_SCORE - 1 });
      expect(result.passed).toBe(false);
    });

    it('throws BadRequestException for invalid startedAt', async () => {
      jest.spyOn(prisma.skillAssessment, 'findUnique').mockResolvedValue(makeAssessment() as any);

      await expect(
        service.submitAssessment(CONTRIBUTOR, { ...validDto, startedAt: 'not-a-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown assessmentId', async () => {
      jest.spyOn(prisma.skillAssessment, 'findUnique').mockResolvedValue(null);

      await expect(service.submitAssessment(CONTRIBUTOR, validDto)).rejects.toThrow(NotFoundException);
    });
  });

  // ── checkCertification ─────────────────────────────────────────────────────

  describe('checkCertification', () => {
    it('returns valid certification that has not expired', async () => {
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(makeCert() as any);

      const result = await service.checkCertification({ contributorId: CONTRIBUTOR, domain: 'backend' });

      expect(result).not.toBeNull();
      expect(result.isValid).toBe(true);
    });

    it('returns isValid=false for expired certification', async () => {
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(
        makeCert({ expiresAt: new Date(Date.now() - 1000) }) as any,
      );

      const result = await service.checkCertification({ contributorId: CONTRIBUTOR, domain: 'backend' });
      expect(result.isValid).toBe(false);
    });

    it('returns isValid=false for revoked certification', async () => {
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(
        makeCert({ revokedAt: new Date() }) as any,
      );

      const result = await service.checkCertification({ contributorId: CONTRIBUTOR, domain: 'backend' });
      expect(result.isValid).toBe(false);
    });

    it('returns null when no certification exists', async () => {
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(null);

      const result = await service.checkCertification({ contributorId: CONTRIBUTOR, domain: 'backend' });
      expect(result).toBeNull();
    });
  });

  // ── checkBountyAccess ──────────────────────────────────────────────────────

  describe('checkBountyAccess', () => {
    it('grants access to an unlocked bounty without checking certifications', async () => {
      const result = await service.checkBountyAccess('open-bounty-99', CONTRIBUTOR);

      expect(result.hasAccess).toBe(true);
      expect(result.requiresCertification).toBe(false);
      expect(prisma.certification.findUnique).not.toHaveBeenCalled();
    });

    it('grants access to a locked bounty when a valid cert exists', async () => {
      service.lockBounty('hard-bounty-1', 'backend');
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(makeCert() as any);

      const result = await service.checkBountyAccess('hard-bounty-1', CONTRIBUTOR);

      expect(result.requiresCertification).toBe(true);
      expect(result.hasAccess).toBe(true);
    });

    it('denies access to a locked bounty with no certification', async () => {
      service.lockBounty('hard-bounty-2', 'smart_contracts');
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(null);

      const result = await service.checkBountyAccess('hard-bounty-2', CONTRIBUTOR);

      expect(result.hasAccess).toBe(false);
      expect(result.domain).toBe('smart_contracts');
    });

    it('denies access when certification is expired', async () => {
      service.lockBounty('hard-bounty-3', 'frontend');
      jest.spyOn(prisma.certification, 'findUnique').mockResolvedValue(
        makeCert({ domain: 'frontend', expiresAt: new Date(Date.now() - 1000) }) as any,
      );

      const result = await service.checkBountyAccess('hard-bounty-3', CONTRIBUTOR);
      expect(result.hasAccess).toBe(false);
    });
  });

  // ── lockBounty / unlockBounty ──────────────────────────────────────────────

  describe('lockBounty / unlockBounty', () => {
    it('registers and removes a bounty from the locked registry', () => {
      service.lockBounty('b-test', 'backend');
      expect(service.listLockedBounties().map((x) => x.bountyId)).toContain('b-test');

      service.unlockBounty('b-test');
      expect(service.listLockedBounties().map((x) => x.bountyId)).not.toContain('b-test');
    });
  });

  // ── recordMentorship ───────────────────────────────────────────────────────

  describe('recordMentorship', () => {
    it('awards mentor_others badge after reaching threshold', async () => {
      const existing = Array.from({ length: MENTOR_THRESHOLD - 1 }, (_, i) => `mentee-${i}`);
      jest.spyOn(prisma.contributorBadge, 'findUnique').mockResolvedValue({
        ...makeBadge('mentor_others'),
        metadata: JSON.stringify({ menteeIds: existing }),
      } as any);
      jest.spyOn(prisma.contributorBadge, 'upsert').mockResolvedValue({} as any);

      const result = await service.recordMentorship(CONTRIBUTOR, { menteeId: 'mentee-new' });

      expect(prisma.contributorBadge.upsert).toHaveBeenCalled();
      expect(result.menteeCount).toBeGreaterThanOrEqual(MENTOR_THRESHOLD);
    });

    it('does not award badge before threshold', async () => {
      jest.spyOn(prisma.contributorBadge, 'findUnique').mockResolvedValue(null);

      const result = await service.recordMentorship(CONTRIBUTOR, { menteeId: 'mentee-1' });

      expect(result.menteeCount).toBe(1);
      expect(result.badgeAwarded).toBe(false);
    });

    it('does not double-count the same mentee', async () => {
      jest.spyOn(prisma.contributorBadge, 'findUnique').mockResolvedValue({
        ...makeBadge('mentor_others'),
        metadata: JSON.stringify({ menteeIds: ['mentee-A'] }),
      } as any);
      jest.spyOn(prisma.contributorBadge, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.contributorBadge, 'upsert').mockResolvedValue({} as any);

      const result = await service.recordMentorship(CONTRIBUTOR, { menteeId: 'mentee-A' });

      expect(result.menteeCount).toBe(1);
    });

    it('throws BadRequestException when mentor and mentee are the same', async () => {
      await expect(
        service.recordMentorship(CONTRIBUTOR, { menteeId: CONTRIBUTOR }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getBadges ──────────────────────────────────────────────────────────────

  describe('getBadges', () => {
    it('returns all badges for a contributor', async () => {
      jest.spyOn(prisma.contributorBadge, 'findMany').mockResolvedValue([
        makeBadge('first_contribution'),
        makeBadge('first_certification'),
      ] as any);

      const result = await service.getBadges(CONTRIBUTOR);

      expect(result).toHaveLength(2);
      expect(result[0].badge).toBe('first_contribution');
    });

    it('returns empty array when no badges earned yet', async () => {
      jest.spyOn(prisma.contributorBadge, 'findMany').mockResolvedValue([]);

      const result = await service.getBadges(CONTRIBUTOR);

      expect(result).toHaveLength(0);
    });
  });

  // ── listAssessments ────────────────────────────────────────────────────────

  describe('listAssessments', () => {
    it('seeds assessments and returns all when no domain filter', async () => {
      jest.spyOn(prisma.skillAssessment, 'upsert').mockResolvedValue({} as any);
      jest.spyOn(prisma.skillAssessment, 'findMany').mockResolvedValue(
        ASSESSMENT_DEFINITIONS.map((d) => ({
          ...d, id: 'id', maxScore: 100, passingScore: PASS_SCORE, createdAt: new Date(),
        })) as any,
      );

      const result = await service.listAssessments();

      expect(prisma.skillAssessment.upsert).toHaveBeenCalledTimes(ASSESSMENT_DEFINITIONS.length);
      expect(result).toHaveLength(ASSESSMENT_DEFINITIONS.length);
    });

    it('passes domain filter to Prisma findMany', async () => {
      jest.spyOn(prisma.skillAssessment, 'upsert').mockResolvedValue({} as any);
      jest.spyOn(prisma.skillAssessment, 'findMany').mockResolvedValue([makeAssessment()] as any);

      await service.listAssessments('backend');

      expect(prisma.skillAssessment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { domain: 'backend' } }),
      );
    });
  });
});
