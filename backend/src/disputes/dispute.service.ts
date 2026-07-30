import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  OpenDisputeDto,
  AddEvidenceDto,
  ExtendReviewDto,
  MakeDecisionDto,
  FileAppealDto,
  DisputeQueryDto,
  PAYMENT_BPS,
} from './dispute.dto';

// ── Constants ────────────────────────────────────────────────────────────────

/** Default arbitrator review window in days */
const DEFAULT_REVIEW_DAYS = 7;

/** Maximum review window in days (when extended) */
const MAX_REVIEW_DAYS = 14;

/** Maximum number of appeals allowed per dispute */
const MAX_APPEALS = 1;

// ── Audit action constants ───────────────────────────────────────────────────

const ACTIONS = {
  DISPUTE_OPENED: 'DISPUTE_OPENED',
  REVIEW_STARTED: 'REVIEW_STARTED',
  EVIDENCE_SUBMITTED: 'EVIDENCE_SUBMITTED',
  REVIEW_EXTENDED: 'REVIEW_EXTENDED',
  DECISION_MADE: 'DECISION_MADE',
  APPEAL_FILED: 'APPEAL_FILED',
  APPEAL_DECIDED: 'APPEAL_DECIDED',
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DisputeService {
  private readonly logger = new Logger(DisputeService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Dispute lifecycle ──────────────────────────────────────────────────────

  /**
   * Open a new dispute.
   * Triggered by a contributor when their submission is rejected.
   *
   * Transitions: (none) → opened
   */
  async openDispute(dto: OpenDisputeDto, contributorId: string) {
    const disputeId = generateId('dispute');
    const now = new Date();
    const reviewDeadline = addDays(now, DEFAULT_REVIEW_DAYS);

    const dispute = await this.prisma.dispute.create({
      data: {
        disputeId,
        bountyId: dto.bountyId,
        contributorId,
        reviewerId: dto.reviewerId,
        arbitratorId: dto.arbitratorId ?? null,
        status: 'opened',
        reviewDeadline,
        reviewExtended: false,
        appealCount: 0,
      },
    });

    // Attach any initial evidence
    if (dto.initialEvidence && dto.initialEvidence.length > 0) {
      await this.attachEvidenceBatch(
        disputeId,
        contributorId,
        dto.initialEvidence,
        false,
      );
    }

    await this.writeAuditLog(
      disputeId,
      contributorId,
      ACTIONS.DISPUTE_OPENED,
      { bountyId: dto.bountyId, reviewerId: dto.reviewerId },
    );

    this.logger.log(`Dispute opened: ${disputeId} by contributor ${contributorId}`);
    return this.findOne(disputeId);
  }

  /**
   * Assign or confirm the arbitrator and move the dispute to under_review.
   * Can be called by the arbitrator themselves or an admin.
   *
   * Transitions: opened → under_review
   */
  async startReview(disputeId: string, arbitratorId: string) {
    const dispute = await this.getDisputeOrThrow(disputeId);

    if (dispute.status !== 'opened') {
      throw new BadRequestException(
        `Cannot start review: dispute is in status '${dispute.status}', expected 'opened'`,
      );
    }

    await this.prisma.dispute.update({
      where: { disputeId },
      data: {
        status: 'under_review',
        arbitratorId,
      },
    });

    await this.writeAuditLog(disputeId, arbitratorId, ACTIONS.REVIEW_STARTED, {
      arbitratorId,
    });

    this.logger.log(`Dispute ${disputeId} moved to under_review by ${arbitratorId}`);
    return this.findOne(disputeId);
  }

  // ── Evidence collection ────────────────────────────────────────────────────

  /**
   * Submit evidence for a dispute.
   * Allowed in states: opened, under_review, appealed.
   */
  async addEvidence(
    disputeId: string,
    dto: AddEvidenceDto,
    submittedBy: string,
    isAppeal = false,
  ) {
    const dispute = await this.getDisputeOrThrow(disputeId);

    const allowedStatuses = ['opened', 'under_review', 'appealed'];
    if (!allowedStatuses.includes(dispute.status)) {
      throw new BadRequestException(
        `Cannot add evidence: dispute is in status '${dispute.status}'`,
      );
    }

    const evidence = await this.createEvidenceRecord(
      disputeId,
      submittedBy,
      dto,
      isAppeal,
    );

    await this.writeAuditLog(disputeId, submittedBy, ACTIONS.EVIDENCE_SUBMITTED, {
      evidenceId: evidence.evidenceId,
      type: dto.type,
      title: dto.title,
      isAppeal,
    });

    return evidence;
  }

  // ── Review window management ───────────────────────────────────────────────

  /**
   * Extend the review deadline from 7 days to 14 days (one-time, arbitrator only).
   *
   * Transitions: under_review → under_review (deadline extended)
   */
  async extendReview(disputeId: string, dto: ExtendReviewDto, arbitratorId: string) {
    const dispute = await this.getDisputeOrThrow(disputeId);

    if (dispute.status !== 'under_review') {
      throw new BadRequestException(
        `Cannot extend review: dispute is in status '${dispute.status}'`,
      );
    }

    if (!dto.extend) {
      throw new BadRequestException('extend must be true');
    }

    if (dispute.reviewExtended) {
      throw new BadRequestException(
        'Review period has already been extended. Maximum is 14 days.',
      );
    }

    if (dispute.arbitratorId && dispute.arbitratorId !== arbitratorId) {
      throw new ForbiddenException('Only the assigned arbitrator can extend the review period');
    }

    const newDeadline = addDays(dispute.createdAt, MAX_REVIEW_DAYS);

    await this.prisma.dispute.update({
      where: { disputeId },
      data: {
        reviewDeadline: newDeadline,
        reviewExtended: true,
      },
    });

    await this.writeAuditLog(disputeId, arbitratorId, ACTIONS.REVIEW_EXTENDED, {
      newDeadline,
      maxDays: MAX_REVIEW_DAYS,
    });

    this.logger.log(`Dispute ${disputeId} review extended to ${newDeadline.toISOString()}`);
    return this.findOne(disputeId);
  }

  // ── Decision ───────────────────────────────────────────────────────────────

  /**
   * Arbitrator makes a binding decision.
   *
   * Transitions: under_review → decided
   * On appeal:   appealed    → final
   */
  async makeDecision(
    disputeId: string,
    dto: MakeDecisionDto,
    arbitratorId: string,
  ) {
    const dispute = await this.getDisputeOrThrow(disputeId);

    const allowedForDecision = ['under_review', 'appealed'];
    if (!allowedForDecision.includes(dispute.status)) {
      throw new BadRequestException(
        `Cannot make decision: dispute is in status '${dispute.status}'`,
      );
    }

    if (dispute.arbitratorId && dispute.arbitratorId !== arbitratorId) {
      throw new ForbiddenException('Only the assigned arbitrator can make a decision');
    }

    const isAppealDecision = dispute.status === 'appealed';
    const nextStatus = isAppealDecision ? 'final' : 'decided';
    const paymentBps = PAYMENT_BPS[dto.decision];
    const now = new Date();

    const decisionId = generateId('decision');

    const [decision] = await this.prisma.$transaction([
      this.prisma.disputeDecision.create({
        data: {
          decisionId,
          disputeId,
          arbitratorId,
          decision: dto.decision,
          rationale: dto.rationale,
          paymentBps,
          isAppeal: isAppealDecision,
        },
      }),
      this.prisma.dispute.update({
        where: { disputeId },
        data: {
          status: nextStatus,
          decidedAt: isAppealDecision ? dispute.decidedAt : now,
          finalizedAt: isAppealDecision ? now : null,
        },
      }),
    ]);

    const action = isAppealDecision ? ACTIONS.APPEAL_DECIDED : ACTIONS.DECISION_MADE;
    await this.writeAuditLog(disputeId, arbitratorId, action, {
      decisionId,
      decision: dto.decision,
      paymentBps,
      rationale: dto.rationale,
      isAppealDecision,
    });

    this.logger.log(
      `Dispute ${disputeId} decision: ${dto.decision} (${paymentBps} bps) → ${nextStatus}`,
    );

    return this.findOne(disputeId);
  }

  // ── Appeal ─────────────────────────────────────────────────────────────────

  /**
   * Contributor files an appeal against a 'decided' dispute.
   * Requires at least one new piece of evidence.
   * Maximum 1 appeal allowed.
   *
   * Transitions: decided → appealed
   */
  async fileAppeal(
    disputeId: string,
    dto: FileAppealDto,
    contributorId: string,
  ) {
    const dispute = await this.getDisputeOrThrow(disputeId);

    if (dispute.status !== 'decided') {
      throw new BadRequestException(
        `Cannot appeal: dispute is in status '${dispute.status}', expected 'decided'`,
      );
    }

    if (dispute.contributorId !== contributorId) {
      throw new ForbiddenException('Only the original contributor can file an appeal');
    }

    if (dispute.appealCount >= MAX_APPEALS) {
      throw new BadRequestException(
        `Maximum of ${MAX_APPEALS} appeal(s) allowed per dispute`,
      );
    }

    if (!dto.newEvidence || dto.newEvidence.length === 0) {
      throw new BadRequestException(
        'At least one new piece of evidence must be submitted with an appeal',
      );
    }

    const now = new Date();

    // Attach the new evidence before updating status so it's linked correctly
    await this.attachEvidenceBatch(
      disputeId,
      contributorId,
      dto.newEvidence,
      true, // isAppeal = true
    );

    await this.prisma.dispute.update({
      where: { disputeId },
      data: {
        status: 'appealed',
        appealCount: { increment: 1 },
        appealedAt: now,
        appealReason: dto.appealReason,
        // Reset decidedAt so arbitrator must issue a fresh decision
        decidedAt: null,
      },
    });

    await this.writeAuditLog(disputeId, contributorId, ACTIONS.APPEAL_FILED, {
      appealReason: dto.appealReason,
      newEvidenceCount: dto.newEvidence.length,
    });

    this.logger.log(
      `Appeal filed on dispute ${disputeId} by contributor ${contributorId}`,
    );

    return this.findOne(disputeId);
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /**
   * Find a single dispute with all related data.
   */
  async findOne(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { disputeId },
      include: {
        evidence: { orderBy: { createdAt: 'asc' } },
        decisions: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    return dispute;
  }

  /**
   * List disputes with optional filters.
   */
  async findAll(query: DisputeQueryDto) {
    return this.prisma.dispute.findMany({
      where: {
        ...(query.bountyId && { bountyId: query.bountyId }),
        ...(query.contributorId && { contributorId: query.contributorId }),
        ...(query.arbitratorId && { arbitratorId: query.arbitratorId }),
        ...(query.status && { status: query.status }),
      },
      include: {
        evidence: { orderBy: { createdAt: 'asc' } },
        decisions: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get the full audit trail for a dispute.
   */
  async getAuditLog(disputeId: string) {
    await this.getDisputeOrThrow(disputeId);

    return this.prisma.disputeAuditLog.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get all evidence for a dispute.
   */
  async getEvidence(disputeId: string) {
    await this.getDisputeOrThrow(disputeId);

    return this.prisma.evidence.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Return summary stats for disputes (useful for dashboards).
   */
  async getStats() {
    const [total, opened, underReview, decided, appealed, final] =
      await Promise.all([
        this.prisma.dispute.count(),
        this.prisma.dispute.count({ where: { status: 'opened' } }),
        this.prisma.dispute.count({ where: { status: 'under_review' } }),
        this.prisma.dispute.count({ where: { status: 'decided' } }),
        this.prisma.dispute.count({ where: { status: 'appealed' } }),
        this.prisma.dispute.count({ where: { status: 'final' } }),
      ]);

    return { total, opened, underReview, decided, appealed, final };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Fetch a dispute by its business ID, throwing 404 if missing. */
  private async getDisputeOrThrow(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { disputeId },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }

    return dispute;
  }

  /** Create a single evidence record. */
  private async createEvidenceRecord(
    disputeId: string,
    submittedBy: string,
    dto: AddEvidenceDto,
    isAppeal: boolean,
  ) {
    return this.prisma.evidence.create({
      data: {
        evidenceId: generateId('evidence'),
        disputeId,
        submittedBy,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        metadata: dto.metadata ?? null,
        isAppeal,
      },
    });
  }

  /** Create multiple evidence records in a single transaction. */
  private async attachEvidenceBatch(
    disputeId: string,
    submittedBy: string,
    items: AddEvidenceDto[],
    isAppeal: boolean,
  ) {
    await this.prisma.$transaction(
      items.map(item =>
        this.prisma.evidence.create({
          data: {
            evidenceId: generateId('evidence'),
            disputeId,
            submittedBy,
            type: item.type,
            title: item.title,
            content: item.content,
            metadata: item.metadata ?? null,
            isAppeal,
          },
        }),
      ),
    );
  }

  /** Append an entry to the immutable audit log. */
  private async writeAuditLog(
    disputeId: string,
    actorId: string,
    action: string,
    payload: Record<string, any> = {},
  ) {
    await this.prisma.disputeAuditLog.create({
      data: {
        logId: generateId('log'),
        disputeId,
        actorId,
        action,
        payload: JSON.stringify(payload),
      },
    });
  }
}
