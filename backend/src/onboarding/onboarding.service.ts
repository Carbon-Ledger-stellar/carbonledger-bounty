import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  UpdateStepDto,
  SubmitAssessmentDto,
  CheckCertificationDto,
  RecordMentorshipDto,
  OnboardingQueryDto,
  ONBOARDING_STEPS,
  ASSESSMENT_DEFINITIONS,
  PASS_SCORE,
  CERT_VALIDITY_MS,
  MENTOR_THRESHOLD,
  STEP_KEYS,
  CertificationDomain,
  OnboardingProgressResponse,
  CertificationResponse,
  BadgeResponse,
  BountyAccessResponse,
} from './onboarding.dto';

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Bounties that require a certification before a contributor can apply.
 * Key = bountyId, value = certification domain required.
 *
 * In a future schema migration this table could move to Prisma; for now
 * bounties are in-memory so we mirror that pattern here.
 */
const LOCKED_BOUNTIES: Record<string, CertificationDomain> = {
  // These IDs correspond to the harder seeded bounties in BountiesService.
  // Any bounty with difficulty intermediate/advanced/expert can be registered here.
  // Maintainers call POST /onboarding/locked-bounties to add more at runtime.
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  /**
   * Runtime registry of locked bounties (bountyId → domain).
   * Pre-populated from LOCKED_BOUNTIES; maintainers can extend at runtime.
   */
  private lockedBounties: Map<string, CertificationDomain> = new Map(
    Object.entries(LOCKED_BOUNTIES) as [string, CertificationDomain][],
  );

  constructor(private readonly prisma: PrismaService) {}

  // ── Onboarding progress ───────────────────────────────────────────────────

  /**
   * Start (or retrieve) a contributor's onboarding progress.
   * Idempotent — safe to call multiple times.
   */
  async startOnboarding(contributorId: string): Promise<OnboardingProgressResponse> {
    let progress = await this.prisma.onboardingProgress.findUnique({
      where: { contributorId },
      include: { steps: true },
    });

    if (!progress) {
      // Create the progress record plus all 5 steps in one transaction
      progress = await this.prisma.$transaction(async (tx) => {
        const created = await tx.onboardingProgress.create({
          data: {
            contributorId,
            status: 'not_started',
            steps: {
              create: ONBOARDING_STEPS.map((s) => ({
                stepKey: s.stepKey,
                title: s.title,
                description: s.description,
                status: 'not_started',
              })),
            },
          },
          include: { steps: true },
        });
        return created;
      });

      this.logger.log(`Onboarding started for contributor ${contributorId}`);
    }

    return this.formatProgress(progress);
  }

  /**
   * Get a contributor's current onboarding progress.
   */
  async getProgress(contributorId: string): Promise<OnboardingProgressResponse> {
    const progress = await this.prisma.onboardingProgress.findUnique({
      where: { contributorId },
      include: { steps: true },
    });

    if (!progress) {
      throw new NotFoundException(
        `No onboarding record found for contributor ${contributorId}. Call POST /onboarding/start first.`,
      );
    }

    return this.formatProgress(progress);
  }

  /**
   * Update a single onboarding step (mark in_progress or completed).
   * Automatically advances overall status and awards first_contribution badge
   * when all 5 steps are completed.
   */
  async updateStep(contributorId: string, dto: UpdateStepDto): Promise<OnboardingProgressResponse> {
    const progress = await this.prisma.onboardingProgress.findUnique({
      where: { contributorId },
      include: { steps: true },
    });

    if (!progress) {
      throw new NotFoundException(
        `No onboarding record for ${contributorId}. Start onboarding first.`,
      );
    }

    const step = progress.steps.find((s) => s.stepKey === dto.stepKey);
    if (!step) {
      throw new NotFoundException(`Step '${dto.stepKey}' not found.`);
    }

    if (step.status === 'completed' && dto.status === 'completed') {
      throw new ConflictException(`Step '${dto.stepKey}' is already completed.`);
    }

    const now = new Date();
    const stepUpdate: any = { status: dto.status };

    if (dto.status === 'completed') {
      stepUpdate.completedAt = now;
      // Track duration if step was started
      if (step.status === 'in_progress' && !step.completedAt) {
        // duration approximated — step startedAt is not stored, use createdAt as proxy
        stepUpdate.durationMs = now.getTime() - progress.createdAt.getTime();
      }
    }

    await this.prisma.onboardingStep.update({
      where: { id: step.id },
      data: stepUpdate,
    });

    // Recalculate overall status
    const updatedSteps = progress.steps.map((s) =>
      s.stepKey === dto.stepKey ? { ...s, ...stepUpdate } : s,
    );
    const completedCount = updatedSteps.filter((s) => s.status === 'completed').length;
    const allDone = completedCount === STEP_KEYS.length;
    const anyStarted = updatedSteps.some((s) => s.status !== 'not_started');

    const newStatus = allDone ? 'completed' : anyStarted ? 'in_progress' : 'not_started';

    await this.prisma.onboardingProgress.update({
      where: { contributorId },
      data: {
        status: newStatus,
        ...(allDone && progress.status !== 'completed' ? { completedAt: now } : {}),
      },
    });

    // Award first_contribution badge when onboarding completes
    if (allDone && progress.status !== 'completed') {
      await this.awardBadgeIfNotHeld(contributorId, 'first_contribution', {
        event: 'onboarding_completed',
      });
    }

    return this.getProgress(contributorId);
  }

  /**
   * List all onboarding progress records (admin / leaderboard use).
   */
  async listProgress(query: OnboardingQueryDto) {
    return this.prisma.onboardingProgress.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
      },
      include: { steps: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Skill assessments ─────────────────────────────────────────────────────

  /**
   * List all available skill assessments, seeding them into the DB on first call.
   */
  async listAssessments(domain?: string) {
    await this.seedAssessmentsIfNeeded();

    return this.prisma.skillAssessment.findMany({
      where: domain ? { domain } : {},
      orderBy: [{ domain: 'asc' }, { title: 'asc' }],
    });
  }

  /**
   * Submit a score for a skill assessment.
   * If score >= PASS_SCORE and no valid certification exists, issues one.
   * Also checks for first_certification badge.
   */
  async submitAssessment(contributorId: string, dto: SubmitAssessmentDto) {
    await this.seedAssessmentsIfNeeded();

    const assessment = await this.prisma.skillAssessment.findUnique({
      where: { assessmentId: dto.assessmentId },
    });

    if (!assessment) {
      throw new NotFoundException(`Assessment ${dto.assessmentId} not found.`);
    }

    const startedAt = new Date(dto.startedAt);
    if (isNaN(startedAt.getTime())) {
      throw new BadRequestException('startedAt must be a valid ISO 8601 date string.');
    }

    const passed = dto.score >= PASS_SCORE;

    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        attemptId: generateId('attempt'),
        assessmentId: dto.assessmentId,
        contributorId,
        score: dto.score,
        passed,
        startedAt,
      },
    });

    this.logger.log(
      `Assessment attempt ${attempt.attemptId}: contributor=${contributorId} domain=${assessment.domain} score=${dto.score} passed=${passed}`,
    );

    let certification: CertificationResponse | null = null;

    if (passed) {
      certification = await this.issueCertificationIfEligible(
        contributorId,
        assessment.domain as CertificationDomain,
        dto.score,
      );
    }

    return { attempt, passed, certification };
  }

  /**
   * Get all assessment attempts for a contributor.
   */
  async getAttempts(contributorId: string) {
    return this.prisma.assessmentAttempt.findMany({
      where: { contributorId },
      include: { assessment: true },
      orderBy: { completedAt: 'desc' },
    });
  }

  // ── Certification ─────────────────────────────────────────────────────────

  /**
   * Get all active certifications for a contributor.
   */
  async getCertifications(contributorId: string): Promise<CertificationResponse[]> {
    const certs = await this.prisma.certification.findMany({
      where: { contributorId },
      orderBy: { issuedAt: 'desc' },
    });

    return certs.map((c) => this.formatCert(c));
  }

  /**
   * Check whether a contributor holds a valid (non-expired, non-revoked)
   * certification for a given domain.
   */
  async checkCertification(dto: CheckCertificationDto): Promise<CertificationResponse | null> {
    const cert = await this.prisma.certification.findUnique({
      where: { contributorId_domain: { contributorId: dto.contributorId, domain: dto.domain } },
    });

    if (!cert) return null;
    return this.formatCert(cert);
  }

  // ── Locked bounties ───────────────────────────────────────────────────────

  /**
   * Register a bounty as requiring a certification to apply.
   */
  lockBounty(bountyId: string, domain: CertificationDomain): void {
    this.lockedBounties.set(bountyId, domain);
    this.logger.log(`Bounty ${bountyId} locked — requires ${domain} certification`);
  }

  /**
   * Remove a bounty's certification requirement.
   */
  unlockBounty(bountyId: string): void {
    this.lockedBounties.delete(bountyId);
    this.logger.log(`Bounty ${bountyId} unlocked`);
  }

  /**
   * Check whether a contributor has access to a (potentially locked) bounty.
   */
  async checkBountyAccess(
    bountyId: string,
    contributorId: string,
  ): Promise<BountyAccessResponse> {
    const domain = this.lockedBounties.get(bountyId) ?? null;

    if (!domain) {
      return {
        contributorId,
        bountyId,
        requiresCertification: false,
        domain: null,
        hasAccess: true,
        reason: 'Bounty is open to all contributors.',
      };
    }

    const cert = await this.checkCertification({ contributorId, domain });

    const hasAccess = cert !== null && cert.isValid;
    const reason = hasAccess
      ? `Valid ${domain} certification found (expires ${cert.expiresAt.toISOString()}).`
      : cert
      ? `${domain} certification has expired. Please re-certify.`
      : `${domain} certification required. Complete the skill assessment to unlock.`;

    return {
      contributorId,
      bountyId,
      requiresCertification: true,
      domain,
      hasAccess,
      reason,
    };
  }

  /**
   * List all currently locked bounties.
   */
  listLockedBounties(): Array<{ bountyId: string; domain: CertificationDomain }> {
    return Array.from(this.lockedBounties.entries()).map(([bountyId, domain]) => ({
      bountyId,
      domain,
    }));
  }

  // ── Badges ────────────────────────────────────────────────────────────────

  /**
   * Get all badges earned by a contributor.
   */
  async getBadges(contributorId: string): Promise<BadgeResponse[]> {
    const badges = await this.prisma.contributorBadge.findMany({
      where: { contributorId },
      orderBy: { awardedAt: 'asc' },
    });

    return badges.map((b) => ({
      badgeId: b.badgeId,
      contributorId: b.contributorId,
      badge: b.badge,
      awardedAt: b.awardedAt,
      metadata: b.metadata,
    }));
  }

  // ── Mentorship ────────────────────────────────────────────────────────────

  /**
   * Record a mentorship event for a contributor.
   * Awards mentor_others badge when MENTOR_THRESHOLD unique mentees are reached.
   */
  async recordMentorship(
    mentorId: string,
    dto: RecordMentorshipDto,
  ): Promise<{ menteeCount: number; badgeAwarded: boolean }> {
    if (mentorId === dto.menteeId) {
      throw new BadRequestException('A contributor cannot mentor themselves.');
    }

    // We track mentorships via the badge metadata — count unique menteeIds
    // stored in the mentor_others badge metadata (simple approach, no separate table)
    const existing = await this.prisma.contributorBadge.findUnique({
      where: { contributorId_badge: { contributorId: mentorId, badge: 'mentor_others' } },
    });

    let menteeIds: string[] = [];
    if (existing && existing.metadata) {
      try {
        const meta = JSON.parse(existing.metadata);
        menteeIds = meta.menteeIds ?? [];
      } catch {
        menteeIds = [];
      }
    }

    if (!menteeIds.includes(dto.menteeId)) {
      menteeIds.push(dto.menteeId);
    }

    const menteeCount = menteeIds.length;
    let badgeAwarded = false;

    if (menteeCount >= MENTOR_THRESHOLD) {
      // Upsert the badge with updated metadata
      await this.prisma.contributorBadge.upsert({
        where: { contributorId_badge: { contributorId: mentorId, badge: 'mentor_others' } },
        update: { metadata: JSON.stringify({ menteeIds, notes: dto.notes }) },
        create: {
          badgeId: generateId('badge'),
          contributorId: mentorId,
          badge: 'mentor_others',
          metadata: JSON.stringify({ menteeIds, notes: dto.notes }),
        },
      });
      badgeAwarded = !existing; // Only report "awarded" the first time threshold is crossed
      this.logger.log(`Badge mentor_others awarded to ${mentorId} (${menteeCount} mentees)`);
    } else {
      // Store progress in a separate record until threshold is hit
      if (existing) {
        await this.prisma.contributorBadge.update({
          where: { contributorId_badge: { contributorId: mentorId, badge: 'mentor_others' } },
          data: { metadata: JSON.stringify({ menteeIds, notes: dto.notes }) },
        });
      }
      // If no badge record yet, we still track in-memory via the upsert
      // when threshold is crossed above. Before threshold, no DB record exists.
    }

    return { menteeCount, badgeAwarded };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Format a raw Prisma onboardingProgress + steps into the response shape. */
  private formatProgress(progress: any): OnboardingProgressResponse {
    const total = STEP_KEYS.length;
    const completed = progress.steps.filter((s: any) => s.status === 'completed').length;
    const completionPct = Math.round((completed / total) * 100);

    return {
      contributorId: progress.contributorId,
      status: progress.status,
      completionPct,
      completedAt: progress.completedAt,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
      steps: progress.steps.map((s: any) => ({
        stepKey: s.stepKey,
        title: s.title,
        description: s.description,
        status: s.status,
        completedAt: s.completedAt,
        durationMs: s.durationMs,
      })),
    };
  }

  /** Format a raw Prisma Certification record. */
  private formatCert(c: any): CertificationResponse {
    const now = new Date();
    const isValid = c.revokedAt === null && c.expiresAt > now;
    return {
      certificationId: c.certificationId,
      contributorId: c.contributorId,
      domain: c.domain,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
      highestScore: c.highestScore,
      isValid,
    };
  }

  /**
   * Issue or renew a certification for (contributorId, domain) when a passing
   * score is achieved. Updates highestScore if a better score is submitted.
   */
  private async issueCertificationIfEligible(
    contributorId: string,
    domain: CertificationDomain,
    score: number,
  ): Promise<CertificationResponse> {
    const now = new Date();
    const expiresAt = addMs(now, CERT_VALIDITY_MS);

    const existing = await this.prisma.certification.findUnique({
      where: { contributorId_domain: { contributorId, domain } },
    });

    let cert: any;

    if (!existing) {
      cert = await this.prisma.certification.create({
        data: {
          certificationId: generateId('cert'),
          contributorId,
          domain,
          issuedAt: now,
          expiresAt,
          highestScore: score,
        },
      });
      this.logger.log(`Certification issued: ${cert.certificationId} (${domain}) for ${contributorId}`);

      // Award first_certification badge
      await this.awardBadgeIfNotHeld(contributorId, 'first_certification', {
        certificationId: cert.certificationId,
        domain,
      });
    } else {
      // Renew and update highestScore if improved
      cert = await this.prisma.certification.update({
        where: { certificationId: existing.certificationId },
        data: {
          issuedAt: now,
          expiresAt,
          revokedAt: null,
          highestScore: Math.max(existing.highestScore, score),
        },
      });
      this.logger.log(`Certification renewed: ${cert.certificationId} (${domain}) for ${contributorId}`);
    }

    return this.formatCert(cert);
  }

  /** Award a badge to a contributor if they don't already hold it. */
  private async awardBadgeIfNotHeld(
    contributorId: string,
    badge: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    const existing = await this.prisma.contributorBadge.findUnique({
      where: { contributorId_badge: { contributorId, badge } },
    });

    if (existing) return;

    await this.prisma.contributorBadge.create({
      data: {
        badgeId: generateId('badge'),
        contributorId,
        badge,
        metadata: JSON.stringify(metadata),
      },
    });

    this.logger.log(`Badge '${badge}' awarded to ${contributorId}`);
  }

  /**
   * Seed the fixed assessment definitions into the DB on first call.
   * Idempotent — uses upsert so re-running is safe.
   */
  private async seedAssessmentsIfNeeded(): Promise<void> {
    for (const def of ASSESSMENT_DEFINITIONS) {
      await this.prisma.skillAssessment.upsert({
        where: { assessmentId: def.assessmentId },
        update: {},
        create: {
          assessmentId: def.assessmentId,
          domain: def.domain,
          title: def.title,
          description: def.description,
          maxScore: 100,
          passingScore: PASS_SCORE,
        },
      });
    }
  }
}
