import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  AddMilestoneDto,
  ApproveMilestoneDto,
  AuditLogResponse,
  AuditQueryDto,
  CreateEscrowDto,
  EscrowResponse,
  MilestoneQueryDto,
  MilestoneResponse,
  RejectMilestoneDto,
  StartReworkDto,
  SubmitMilestoneDto,
} from './escrow.dto';
import {
  ESCROW_ACTIONS,
  MILESTONE_TRANSITIONS,
  MilestoneStatus,
  REVIEWER_TIMEOUT_DAYS,
} from './milestone.model';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Remaining seconds until reviewer timeout. Negative means already overdue. */
function reviewerTimeoutRemainingSeconds(submittedAt: Date | null): number | null {
  if (!submittedAt) return null;
  const deadline = addDays(submittedAt, REVIEWER_TIMEOUT_DAYS);
  return Math.floor((deadline.getTime() - Date.now()) / 1000);
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Escrow lifecycle ──────────────────────────────────────────────────────

  /**
   * Create a new escrow account for a bounty and seed it with milestones.
   *
   * Validates that milestone paymentAmounts sum to totalAmount.
   * One escrow per bounty — throws ConflictException if one already exists.
   */
  async createEscrow(dto: CreateEscrowDto, actorId: string): Promise<EscrowResponse> {
    // Guard: only one escrow per bounty
    const existing = await this.prisma.escrowAccount.findUnique({
      where: { bountyId: dto.bountyId },
    });
    if (existing) {
      throw new ConflictException(
        `An escrow account already exists for bounty ${dto.bountyId}`,
      );
    }

    // Guard: milestone amounts must sum to totalAmount (within $0.01 rounding tolerance)
    const milestoneSum = dto.milestones.reduce((s, m) => s + m.paymentAmount, 0);
    if (Math.abs(milestoneSum - dto.totalAmount) > 0.01) {
      throw new BadRequestException(
        `Milestone paymentAmounts sum ($${milestoneSum.toFixed(2)}) must equal ` +
        `totalAmount ($${dto.totalAmount.toFixed(2)})`,
      );
    }

    const escrowId = generateId('esc');
    const now = new Date();

    const escrow = await this.prisma.$transaction(async (tx) => {
      const created = await tx.escrowAccount.create({
        data: {
          id: escrowId,
          bountyId: dto.bountyId,
          totalAmount: dto.totalAmount,
          releasedAmount: 0,
          status: 'active',
        },
      });

      // Create all milestones in bulk
      await tx.bountyMilestone.createMany({
        data: dto.milestones.map((m) => ({
          id: generateId('ms'),
          escrowId,
          bountyId: dto.bountyId,
          description: m.description,
          dueDate: new Date(m.dueDate),
          reviewerAddress: m.reviewerAddress,
          paymentAmount: m.paymentAmount,
          status: 'planned',
          autoReleased: false,
        })),
      });

      await tx.escrowAuditLog.create({
        data: {
          id: generateId('alog'),
          escrowId,
          actorId,
          action: ESCROW_ACTIONS.ESCROW_CREATED,
          payload: JSON.stringify({
            bountyId: dto.bountyId,
            totalAmount: dto.totalAmount,
            milestoneCount: dto.milestones.length,
          }),
        },
      });

      await tx.escrowAuditLog.create({
        data: {
          id: generateId('alog'),
          escrowId,
          actorId,
          action: ESCROW_ACTIONS.ESCROW_FUNDED,
          payload: JSON.stringify({ amount: dto.totalAmount }),
        },
      });

      return created;
    });

    this.logger.log(
      `Escrow ${escrowId} created for bounty ${dto.bountyId} ` +
      `($${dto.totalAmount}) by ${actorId}`,
    );

    return this.findEscrowByBounty(dto.bountyId);
  }

  /**
   * Cancel an active escrow. Only allowed when no milestone has been
   * approved or funds-released (no partial disbursement allowed).
   *
   * Transitions: active → cancelled
   */
  async cancelEscrow(bountyId: string, actorId: string): Promise<EscrowResponse> {
    const escrow = await this.getEscrowOrThrow(bountyId);

    if (escrow.status !== 'active') {
      throw new BadRequestException(
        `Cannot cancel escrow with status '${escrow.status}'`,
      );
    }

    const disbursedMilestones = await this.prisma.bountyMilestone.count({
      where: {
        escrowId: escrow.id,
        status: { in: ['approved', 'funds-released'] },
      },
    });
    if (disbursedMilestones > 0) {
      throw new BadRequestException(
        `Cannot cancel escrow: ${disbursedMilestones} milestone(s) already approved or released`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.escrowAccount.update({
        where: { id: escrow.id },
        data: { status: 'cancelled' },
      }),
      this.prisma.escrowAuditLog.create({
        data: {
          id: generateId('alog'),
          escrowId: escrow.id,
          actorId,
          action: ESCROW_ACTIONS.ESCROW_CANCELLED,
          payload: JSON.stringify({ bountyId }),
        },
      }),
    ]);

    this.logger.log(`Escrow ${escrow.id} for bounty ${bountyId} cancelled by ${actorId}`);
    return this.findEscrowByBounty(bountyId);
  }

  // ── Milestone management ──────────────────────────────────────────────────

  /**
   * Add a new milestone to an existing active escrow.
   * The new milestone's payment amount increases the escrow's totalAmount.
   */
  async addMilestone(
    bountyId: string,
    dto: AddMilestoneDto,
    actorId: string,
  ): Promise<MilestoneResponse> {
    const escrow = await this.getEscrowOrThrow(bountyId);

    if (escrow.status !== 'active') {
      throw new BadRequestException(
        `Cannot add milestone to escrow with status '${escrow.status}'`,
      );
    }

    const milestoneId = generateId('ms');

    await this.prisma.$transaction(async (tx) => {
      await tx.bountyMilestone.create({
        data: {
          id: milestoneId,
          escrowId: escrow.id,
          bountyId,
          description: dto.description,
          dueDate: new Date(dto.dueDate),
          reviewerAddress: dto.reviewerAddress,
          paymentAmount: dto.paymentAmount,
          status: 'planned',
          autoReleased: false,
        },
      });

      // Increase totalAmount to reflect the added milestone
      await tx.escrowAccount.update({
        where: { id: escrow.id },
        data: { totalAmount: { increment: dto.paymentAmount } },
      });

      await tx.escrowAuditLog.create({
        data: {
          id: generateId('alog'),
          escrowId: escrow.id,
          milestoneId,
          actorId,
          action: ESCROW_ACTIONS.MILESTONE_CREATED,
          payload: JSON.stringify({
            description: dto.description,
            paymentAmount: dto.paymentAmount,
            dueDate: dto.dueDate,
          }),
        },
      });
    });

    this.logger.log(`Milestone ${milestoneId} added to escrow ${escrow.id} by ${actorId}`);
    return this.getMilestoneResponse(milestoneId);
  }

  // ── Milestone state transitions ───────────────────────────────────────────

  /**
   * Contributor submits a milestone for review.
   * Transitions: planned → in-review
   * Records submittedAt — the clock for reviewer timeout starts here.
   */
  async submitMilestone(
    bountyId: string,
    milestoneId: string,
    dto: SubmitMilestoneDto,
    actorId: string,
  ): Promise<MilestoneResponse> {
    const { escrow, milestone } = await this.getMilestoneContext(bountyId, milestoneId);
    this.assertTransition(milestone.status as MilestoneStatus, 'in-review');

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.bountyMilestone.update({
        where: { id: milestoneId },
        data: {
          status: 'in-review',
          submittedAt: now,
          // Clear any previous rejection feedback on re-submission
          rejectionFeedback: null,
        },
      }),
      this.prisma.escrowAuditLog.create({
        data: {
          id: generateId('alog'),
          escrowId: escrow.id,
          milestoneId,
          actorId,
          action: ESCROW_ACTIONS.MILESTONE_SUBMITTED,
          payload: JSON.stringify({
            submittedAt: now,
            reviewerAddress: milestone.reviewerAddress,
            submissionNotes: dto.submissionNotes ?? null,
            reviewerDeadline: addDays(now, REVIEWER_TIMEOUT_DAYS),
          }),
        },
      }),
    ]);

    this.logger.log(
      `Milestone ${milestoneId} submitted for review by ${actorId}. ` +
      `Reviewer timeout: ${addDays(now, REVIEWER_TIMEOUT_DAYS).toISOString()}`,
    );
    return this.getMilestoneResponse(milestoneId);
  }

  /**
   * Reviewer approves a milestone.
   * Transitions: in-review → approved
   *
   * Only the assigned reviewer for this milestone may approve it.
   */
  async approveMilestone(
    bountyId: string,
    milestoneId: string,
    dto: ApproveMilestoneDto,
    reviewerAddress: string,
  ): Promise<MilestoneResponse> {
    const { escrow, milestone } = await this.getMilestoneContext(bountyId, milestoneId);
    this.assertTransition(milestone.status as MilestoneStatus, 'approved');
    this.assertReviewer(milestone.reviewerAddress, reviewerAddress, milestoneId);

    await this.prisma.$transaction([
      this.prisma.bountyMilestone.update({
        where: { id: milestoneId },
        data: { status: 'approved' },
      }),
      this.prisma.escrowAuditLog.create({
        data: {
          id: generateId('alog'),
          escrowId: escrow.id,
          milestoneId,
          actorId: reviewerAddress,
          action: ESCROW_ACTIONS.MILESTONE_APPROVED,
          payload: JSON.stringify({
            approvalNotes: dto.approvalNotes ?? null,
            paymentAmount: milestone.paymentAmount,
          }),
        },
      }),
    ]);

    this.logger.log(`Milestone ${milestoneId} approved by reviewer ${reviewerAddress}`);
    return this.getMilestoneResponse(milestoneId);
  }

  /**
   * Reviewer rejects a milestone with mandatory written feedback.
   * Transitions: in-review → rejected
   *
   * Only the assigned reviewer for this milestone may reject it.
   * The rejection triggers a re-work cycle: contributor must call startRework()
   * to move the milestone back to planned before re-submitting.
   */
  async rejectMilestone(
    bountyId: string,
    milestoneId: string,
    dto: RejectMilestoneDto,
    reviewerAddress: string,
  ): Promise<MilestoneResponse> {
    const { escrow, milestone } = await this.getMilestoneContext(bountyId, milestoneId);
    this.assertTransition(milestone.status as MilestoneStatus, 'rejected');
    this.assertReviewer(milestone.reviewerAddress, reviewerAddress, milestoneId);

    await this.prisma.$transaction([
      this.prisma.bountyMilestone.update({
        where: { id: milestoneId },
        data: {
          status: 'rejected',
          rejectionFeedback: dto.feedback,
        },
      }),
      this.prisma.escrowAuditLog.create({
        data: {
          id: generateId('alog'),
          escrowId: escrow.id,
          milestoneId,
          actorId: reviewerAddress,
          action: ESCROW_ACTIONS.MILESTONE_REJECTED,
          payload: JSON.stringify({
            feedback: dto.feedback,
            paymentAmount: milestone.paymentAmount,
          }),
        },
      }),
    ]);

    this.logger.log(`Milestone ${milestoneId} rejected by reviewer ${reviewerAddress}`);
    return this.getMilestoneResponse(milestoneId);
  }

  /**
   * Contributor acknowledges the rejection and resets milestone for re-work.
   * Transitions: rejected → planned
   *
   * Clears submittedAt so the reviewer timeout clock resets on next submission.
   */
  async startRework(
    bountyId: string,
    milestoneId: string,
    dto: StartReworkDto,
    actorId: string,
  ): Promise<MilestoneResponse> {
    const { escrow, milestone } = await this.getMilestoneContext(bountyId, milestoneId);
    // assertTransition already enforces rejected → planned;
    // the only path to 'planned' in MILESTONE_TRANSITIONS is from 'rejected'
    this.assertTransition(milestone.status as MilestoneStatus, 'planned');

    await this.prisma.$transaction([
      this.prisma.bountyMilestone.update({
        where: { id: milestoneId },
        data: {
          status: 'planned',
          submittedAt: null,
        },
      }),
      this.prisma.escrowAuditLog.create({
        data: {
          id: generateId('alog'),
          escrowId: escrow.id,
          milestoneId,
          actorId,
          action: ESCROW_ACTIONS.MILESTONE_REWORK_STARTED,
          payload: JSON.stringify({
            reworkNotes: dto.reworkNotes ?? null,
            previousFeedback: milestone.rejectionFeedback,
          }),
        },
      }),
    ]);

    this.logger.log(`Milestone ${milestoneId} moved to rework by ${actorId}`);
    return this.getMilestoneResponse(milestoneId);
  }

  /**
   * Release funds for an approved milestone to the contributor.
   * Transitions: approved → funds-released
   *
   * Updates the escrow's releasedAmount and marks the escrow completed
   * when all milestones are funds-released.
   */
  async releaseFunds(
    bountyId: string,
    milestoneId: string,
    actorId: string,
    autoReleased = false,
  ): Promise<MilestoneResponse> {
    const { escrow, milestone } = await this.getMilestoneContext(bountyId, milestoneId);
    this.assertTransition(milestone.status as MilestoneStatus, 'funds-released');

    const now = new Date();
    const action = autoReleased
      ? ESCROW_ACTIONS.MILESTONE_AUTO_RELEASED
      : ESCROW_ACTIONS.MILESTONE_FUNDS_RELEASED;

    await this.prisma.$transaction(async (tx) => {
      await tx.bountyMilestone.update({
        where: { id: milestoneId },
        data: {
          status: 'funds-released',
          fundsReleasedAt: now,
          autoReleased,
        },
      });

      const updatedEscrow = await tx.escrowAccount.update({
        where: { id: escrow.id },
        data: { releasedAmount: { increment: milestone.paymentAmount } },
      });

      await tx.escrowAuditLog.create({
        data: {
          id: generateId('alog'),
          escrowId: escrow.id,
          milestoneId,
          actorId,
          action,
          payload: JSON.stringify({
            paymentAmount: milestone.paymentAmount,
            releasedAt: now,
            autoReleased,
            totalReleasedSoFar: updatedEscrow.releasedAmount,
          }),
        },
      });

      // Check whether all milestones for this escrow are now funds-released
      const remaining = await tx.bountyMilestone.count({
        where: {
          escrowId: escrow.id,
          status: { not: 'funds-released' },
        },
      });

      if (remaining === 0) {
        await tx.escrowAccount.update({
          where: { id: escrow.id },
          data: { status: 'completed' },
        });

        await tx.escrowAuditLog.create({
          data: {
            id: generateId('alog'),
            escrowId: escrow.id,
            actorId,
            action: ESCROW_ACTIONS.ESCROW_COMPLETED,
            payload: JSON.stringify({
              totalReleased: updatedEscrow.releasedAmount,
              completedAt: now,
            }),
          },
        });

        this.logger.log(
          `Escrow ${escrow.id} fully completed — all milestones funds-released`,
        );
      }
    });

    this.logger.log(
      `Milestone ${milestoneId} funds released ($${milestone.paymentAmount}) ` +
      `by ${actorId}${autoReleased ? ' [AUTO-RELEASE]' : ''}`,
    );
    return this.getMilestoneResponse(milestoneId);
  }

  // ── Auto-release (called by the scheduler) ────────────────────────────────

  /**
   * Scans all in-review milestones whose reviewer timeout has expired
   * and auto-approves + releases funds for each one.
   *
   * Called periodically by EscrowScheduler.
   * Returns the number of milestones auto-released.
   */
  async processAutoReleases(): Promise<number> {
    const cutoff = addDays(new Date(), -REVIEWER_TIMEOUT_DAYS);

    // Find all in-review milestones whose submittedAt is past the cutoff
    const timedOut = await this.prisma.bountyMilestone.findMany({
      where: {
        status: 'in-review',
        submittedAt: { lte: cutoff },
      },
      include: { escrow: true },
    });

    if (timedOut.length === 0) return 0;

    this.logger.log(`Auto-release: ${timedOut.length} milestone(s) timed out`);

    let released = 0;
    for (const milestone of timedOut) {
      try {
        // First auto-approve
        const now = new Date();
        await this.prisma.$transaction([
          this.prisma.bountyMilestone.update({
            where: { id: milestone.id },
            data: { status: 'approved' },
          }),
          this.prisma.escrowAuditLog.create({
            data: {
              id: generateId('alog'),
              escrowId: milestone.escrowId,
              milestoneId: milestone.id,
              actorId: 'system',
              action: ESCROW_ACTIONS.MILESTONE_APPROVED,
              payload: JSON.stringify({
                reason: 'reviewer_timeout',
                submittedAt: milestone.submittedAt,
                timeoutDays: REVIEWER_TIMEOUT_DAYS,
                autoApprovedAt: now,
              }),
            },
          }),
        ]);

        // Then release funds (marks autoReleased = true)
        await this.releaseFunds(milestone.bountyId, milestone.id, 'system', true);
        released++;
      } catch (err) {
        this.logger.error(
          `Auto-release failed for milestone ${milestone.id}: ${(err as Error).message}`,
        );
      }
    }

    return released;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async findEscrowByBounty(bountyId: string): Promise<EscrowResponse> {
    const escrow = await this.prisma.escrowAccount.findUnique({
      where: { bountyId },
      include: { _count: { select: { milestones: true } } },
    });
    if (!escrow) {
      throw new NotFoundException(`No escrow account found for bounty ${bountyId}`);
    }
    return this.toEscrowResponse(escrow);
  }

  async listMilestones(
    bountyId: string,
    query: MilestoneQueryDto,
  ): Promise<MilestoneResponse[]> {
    const escrow = await this.getEscrowOrThrow(bountyId);

    const milestones = await this.prisma.bountyMilestone.findMany({
      where: {
        escrowId: escrow.id,
        ...(query.status && { status: query.status }),
        ...(query.reviewerAddress && { reviewerAddress: query.reviewerAddress }),
      },
      orderBy: { createdAt: 'asc' },
    });

    return milestones.map((m) => this.toMilestoneResponse(m));
  }

  async getMilestone(bountyId: string, milestoneId: string): Promise<MilestoneResponse> {
    await this.getMilestoneContext(bountyId, milestoneId);
    return this.getMilestoneResponse(milestoneId);
  }

  async getAuditLog(
    bountyId: string,
    query: AuditQueryDto,
  ): Promise<AuditLogResponse[]> {
    const escrow = await this.getEscrowOrThrow(bountyId);

    const logs = await this.prisma.escrowAuditLog.findMany({
      where: {
        escrowId: escrow.id,
        ...(query.milestoneId && { milestoneId: query.milestoneId }),
        ...(query.actorId && { actorId: query.actorId }),
        ...(query.action && { action: query.action }),
      },
      orderBy: { createdAt: 'asc' },
      take: query.limit ?? 100,
    });

    return logs.map((l) => ({
      id: l.id,
      escrowId: l.escrowId,
      milestoneId: l.milestoneId,
      actorId: l.actorId,
      action: l.action,
      payload: l.payload ? (JSON.parse(l.payload) as Record<string, unknown>) : null,
      createdAt: l.createdAt,
    }));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Load the escrow for a bounty or throw 404. */
  private async getEscrowOrThrow(bountyId: string) {
    const escrow = await this.prisma.escrowAccount.findUnique({
      where: { bountyId },
    });
    if (!escrow) {
      throw new NotFoundException(`No escrow account found for bounty ${bountyId}`);
    }
    return escrow;
  }

  /** Load both escrow and milestone, verify bounty ownership. */
  private async getMilestoneContext(bountyId: string, milestoneId: string) {
    const escrow = await this.getEscrowOrThrow(bountyId);
    const milestone = await this.prisma.bountyMilestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone || milestone.escrowId !== escrow.id) {
      throw new NotFoundException(
        `Milestone ${milestoneId} not found on bounty ${bountyId}`,
      );
    }
    return { escrow, milestone };
  }

  /** Validate that `toStatus` is a legal next state from `fromStatus`. */
  private assertTransition(fromStatus: MilestoneStatus, toStatus: MilestoneStatus): void {
    const allowed = MILESTONE_TRANSITIONS[fromStatus];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Invalid milestone transition: '${fromStatus}' → '${toStatus}'. ` +
        `Allowed from '${fromStatus}': [${allowed.join(', ') || 'none'}]`,
      );
    }
  }

  /** Verify the caller is the assigned reviewer for this milestone. */
  private assertReviewer(
    assignedReviewer: string,
    callerAddress: string,
    milestoneId: string,
  ): void {
    if (assignedReviewer !== callerAddress) {
      throw new ForbiddenException(
        `Only the assigned reviewer (${assignedReviewer}) can review milestone ${milestoneId}`,
      );
    }
  }

  private async getMilestoneResponse(milestoneId: string): Promise<MilestoneResponse> {
    const m = await this.prisma.bountyMilestone.findUniqueOrThrow({
      where: { id: milestoneId },
    });
    return this.toMilestoneResponse(m);
  }

  private toEscrowResponse(
    escrow: {
      id: string;
      bountyId: string;
      totalAmount: number;
      releasedAmount: number;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      _count?: { milestones: number };
    },
  ): EscrowResponse {
    return {
      id: escrow.id,
      bountyId: escrow.bountyId,
      totalAmount: escrow.totalAmount,
      releasedAmount: escrow.releasedAmount,
      pendingAmount: Math.max(0, escrow.totalAmount - escrow.releasedAmount),
      status: escrow.status as any,
      milestoneCount: escrow._count?.milestones ?? 0,
      createdAt: escrow.createdAt,
      updatedAt: escrow.updatedAt,
    };
  }

  private toMilestoneResponse(m: {
    id: string;
    escrowId: string;
    bountyId: string;
    description: string;
    dueDate: Date;
    reviewerAddress: string;
    paymentAmount: number;
    status: string;
    rejectionFeedback: string | null;
    submittedAt: Date | null;
    fundsReleasedAt: Date | null;
    autoReleased: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): MilestoneResponse {
    const isInReview = m.status === 'in-review';
    return {
      id: m.id,
      escrowId: m.escrowId,
      bountyId: m.bountyId,
      description: m.description,
      dueDate: m.dueDate,
      reviewerAddress: m.reviewerAddress,
      paymentAmount: m.paymentAmount,
      status: m.status as MilestoneStatus,
      rejectionFeedback: m.rejectionFeedback,
      submittedAt: m.submittedAt,
      fundsReleasedAt: m.fundsReleasedAt,
      autoReleased: m.autoReleased,
      reviewerTimeoutRemainingSeconds: isInReview
        ? reviewerTimeoutRemainingSeconds(m.submittedAt)
        : null,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }
}
