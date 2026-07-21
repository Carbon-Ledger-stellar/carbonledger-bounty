import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  MentorProfile,
  ReviewRequest,
  ReviewStatus,
  MentorStatus,
  MentorFeedbackForm,
  MenteeFeedback,
  ReviewSLAMetrics,
  MentorshipMetrics,
  OptInMentorDto,
  UpdateMentorStatusDto,
  SubmitReviewRequestDto,
  SubmitReviewDto,
  SubmitMenteeFeedbackDto,
  GetReviewsQueryDto,
  BountyType,
} from './mentorship.types';
import { CHECKLIST_REGISTRY } from './checklists';
import {
  MENTOR_FEEDBACK_QUESTIONS,
  MENTEE_FEEDBACK_QUESTIONS,
} from './forms/feedback-questions';

/** Minimum reputation score required to become a mentor. */
const MENTOR_MIN_REPUTATION = 80;

/** SLA window in hours — reviewers commit to this turnaround. */
export const REVIEW_SLA_HOURS = 48;

// ─── In-memory stores (replace with Prisma models once migrated) ─────────────
// These maps act as the data layer until MentorProfile / ReviewRequest
// Prisma models are added to schema.prisma.

const mentorStore = new Map<string, MentorProfile>();
const reviewStore = new Map<string, ReviewRequest>();
const menteeFeedbackStore = new Map<string, MenteeFeedback[]>();
const mentorFeedbackStore = new Map<string, MentorFeedbackForm>();

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MentorshipService {
  private readonly logger = new Logger(MentorshipService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Mentor opt-in ────────────────────────────────────────────────────────────

  /**
   * Opt a senior contributor (reputation >80) into mentor status.
   * Eligibility is determined by the caller passing a verified `reputation` value.
   * In production this would be queried from the contributor's profile.
   *
   * @throws ForbiddenException  if reputation < MENTOR_MIN_REPUTATION
   * @throws ConflictException   if mentor profile already exists
   */
  async optInMentor(dto: OptInMentorDto, reputation: number): Promise<MentorProfile> {
    if (reputation < MENTOR_MIN_REPUTATION) {
      throw new ForbiddenException(
        `Reputation score ${reputation} is below the minimum ${MENTOR_MIN_REPUTATION} required to become a mentor.`,
      );
    }

    if (mentorStore.has(dto.publicKey)) {
      throw new ConflictException(
        `Mentor profile for ${dto.publicKey} already exists. Use PATCH /mentorship/mentors/:id to update.`,
      );
    }

    const profile: MentorProfile = {
      userId: dto.publicKey,
      publicKey: dto.publicKey,
      status: 'active',
      reputation,
      specializations: dto.specializations,
      totalReviews: 0,
      avgTurnaroundHours: 0,
      avgHelpfulnessScore: 0,
      reviewCapacityPerWeek: dto.reviewCapacityPerWeek,
      currentReviewCount: 0,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
    };

    mentorStore.set(dto.publicKey, profile);
    this.logger.log(`Mentor opted in: ${dto.publicKey} (rep=${reputation})`);
    return profile;
  }

  /**
   * Update a mentor's availability status (active / inactive / on_break).
   *
   * @throws NotFoundException if mentor profile not found
   */
  async updateMentorStatus(publicKey: string, dto: UpdateMentorStatusDto): Promise<MentorProfile> {
    const profile = this.requireMentor(publicKey);
    profile.status = dto.status;
    profile.lastActiveAt = new Date();
    mentorStore.set(publicKey, profile);
    this.logger.log(`Mentor ${publicKey} status → ${dto.status}`);
    return profile;
  }

  /**
   * Retrieve a single mentor profile.
   *
   * @throws NotFoundException if not found
   */
  getMentor(publicKey: string): MentorProfile {
    return this.requireMentor(publicKey);
  }

  /**
   * List all mentor profiles, optionally filtered by status.
   */
  listMentors(status?: MentorStatus): MentorProfile[] {
    const all = Array.from(mentorStore.values());
    return status ? all.filter((m) => m.status === status) : all;
  }

  // ── Review request lifecycle ─────────────────────────────────────────────────

  /**
   * Submit a new review request for a bounty submission.
   * Automatically assigns to the best available active mentor for the bounty type.
   * SLA deadline is set to REVIEW_SLA_HOURS from now.
   *
   * @throws BadRequestException if no checklist template exists for the bounty type
   */
  async submitReviewRequest(dto: SubmitReviewRequestDto): Promise<ReviewRequest> {
    if (!CHECKLIST_REGISTRY[dto.bountyType]) {
      throw new BadRequestException(`No checklist template for bounty type: ${dto.bountyType}`);
    }

    const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const slaDeadline = new Date(now.getTime() + REVIEW_SLA_HOURS * 60 * 60 * 1000);

    const mentor = this.findAvailableMentor(dto.bountyType);

    const request: ReviewRequest = {
      id,
      bountyId: dto.bountyId,
      bountyTitle: dto.bountyTitle,
      bountyType: dto.bountyType,
      contributorId: dto.contributorId,
      mentorId: mentor?.publicKey ?? null,
      status: mentor ? 'in_review' : 'pending',
      submissionUrl: dto.submissionUrl,
      submittedAt: now,
      assignedAt: mentor ? now : null,
      reviewStartedAt: mentor ? now : null,
      reviewCompletedAt: null,
      slaDeadline,
      slaMet: null,
      checklistResults: [],
      overallScore: null,
      mentorFeedback: null,
      revisionCount: 0,
    };

    reviewStore.set(id, request);

    if (mentor) {
      mentor.currentReviewCount += 1;
      mentorStore.set(mentor.publicKey, mentor);
      this.logger.log(`Review ${id} auto-assigned to mentor ${mentor.publicKey}`);
    } else {
      this.logger.warn(`Review ${id} is pending — no available mentor for type ${dto.bountyType}`);
    }

    return request;
  }

  /**
   * Get a single review request by ID.
   *
   * @throws NotFoundException if not found
   */
  getReviewRequest(reviewId: string): ReviewRequest {
    return this.requireReview(reviewId);
  }

  /**
   * List review requests with optional filters.
   */
  listReviewRequests(query: GetReviewsQueryDto): ReviewRequest[] {
    let results = Array.from(reviewStore.values());

    if (query.status) results = results.filter((r) => r.status === query.status);
    if (query.bountyType) results = results.filter((r) => r.bountyType === query.bountyType);
    if (query.mentorId) results = results.filter((r) => r.mentorId === query.mentorId);
    if (query.contributorId) results = results.filter((r) => r.contributorId === query.contributorId);

    // Sort newest first
    results.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    return results.slice((page - 1) * limit, page * limit);
  }

  // ── Submitting a review ──────────────────────────────────────────────────────

  /**
   * Submit the completed review for a request, including checklist results,
   * overall score, written feedback, and approval/rejection decision.
   *
   * @throws NotFoundException  if review request not found
   * @throws BadRequestException if review is already completed
   * @throws ForbiddenException  if the submitting mentor is not assigned to this review
   */
  async submitReview(dto: SubmitReviewDto): Promise<ReviewRequest> {
    const review = this.requireReview(dto.reviewRequestId);

    if (review.status === 'approved' || review.status === 'rejected') {
      throw new BadRequestException(`Review ${dto.reviewRequestId} is already completed.`);
    }

    if (review.mentorId && review.mentorId !== dto.mentorId) {
      throw new ForbiddenException(
        `Mentor ${dto.mentorId} is not assigned to review ${dto.reviewRequestId}.`,
      );
    }

    const now = new Date();
    const statusMap: Record<string, ReviewStatus> = {
      approved: 'approved',
      changes_requested: 'changes_requested',
      rejected: 'rejected',
    };

    review.checklistResults = dto.checklistResults;
    review.overallScore = dto.overallScore;
    review.mentorFeedback = dto.mentorFeedback;
    review.status = statusMap[dto.decision];
    review.reviewCompletedAt = now;
    review.slaMet = now <= review.slaDeadline;

    if (review.status === 'changes_requested') {
      review.revisionCount += 1;
    }

    reviewStore.set(review.id, review);

    // Update mentor stats
    if (review.mentorId) {
      this.updateMentorStats(review.mentorId, review);
    }

    this.logger.log(
      `Review ${review.id} completed by ${dto.mentorId}: ${dto.decision} (score=${dto.overallScore}, slaMet=${review.slaMet})`,
    );

    return review;
  }

  // ── Feedback ─────────────────────────────────────────────────────────────────

  /**
   * Retrieve the standard mentor feedback questions for a given bounty type.
   * The checklist template for the type is included so the mentor can fill both
   * the checklist and the narrative form in one call.
   */
  getMentorFeedbackForm(bountyType: BountyType) {
    const checklist = CHECKLIST_REGISTRY[bountyType];
    if (!checklist) {
      throw new BadRequestException(`No checklist for bounty type: ${bountyType}`);
    }
    return {
      questions: MENTOR_FEEDBACK_QUESTIONS,
      checklist,
    };
  }

  /**
   * Retrieve the standard mentee feedback questions (for rating mentors).
   */
  getMenteeFeedbackForm() {
    return { questions: MENTEE_FEEDBACK_QUESTIONS };
  }

  /**
   * Submit mentee feedback about a mentor after the review is complete.
   * Updates the mentor's running avg helpfulness score.
   *
   * @throws NotFoundException  if review request not found
   * @throws BadRequestException if the review is not yet complete
   */
  async submitMenteeFeedback(dto: SubmitMenteeFeedbackDto): Promise<MenteeFeedback> {
    const review = this.requireReview(dto.reviewRequestId);

    if (!['approved', 'changes_requested', 'rejected'].includes(review.status)) {
      throw new BadRequestException(
        `Review ${dto.reviewRequestId} is not yet complete. Feedback can only be submitted after the review is finished.`,
      );
    }

    const feedback: MenteeFeedback = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      reviewRequestId: dto.reviewRequestId,
      mentorId: dto.mentorId,
      contributorId: dto.contributorId ?? review.contributorId,
      helpfulnessScore: dto.helpfulnessScore,
      timelinessScore: dto.timelinessScore,
      clarityScore: dto.clarityScore,
      wouldWorkWithAgain: dto.wouldWorkWithAgain,
      comments: dto.comments ?? '',
      submittedAt: new Date(),
    };

    const existing = menteeFeedbackStore.get(dto.mentorId) ?? [];
    existing.push(feedback);
    menteeFeedbackStore.set(dto.mentorId, existing);

    // Recompute mentor's avg helpfulness score
    this.recomputeMentorHelpfulness(dto.mentorId);

    this.logger.log(
      `Mentee feedback submitted for mentor ${dto.mentorId}: helpfulness=${dto.helpfulnessScore}`,
    );

    return feedback;
  }

  /**
   * Get all mentee feedback for a specific mentor.
   */
  getMentorFeedback(mentorId: string): MenteeFeedback[] {
    return menteeFeedbackStore.get(mentorId) ?? [];
  }

  // ── Checklist registry ───────────────────────────────────────────────────────

  /**
   * Return the review checklist template for a given bounty type.
   *
   * @throws NotFoundException if no template exists for the type
   */
  getChecklist(bountyType: BountyType) {
    const template = CHECKLIST_REGISTRY[bountyType];
    if (!template) {
      throw new NotFoundException(`No checklist template found for bounty type: ${bountyType}`);
    }
    return template;
  }

  /**
   * Return all registered checklist templates.
   */
  getAllChecklists() {
    return Object.values(CHECKLIST_REGISTRY);
  }

  // ── SLA & Metrics ────────────────────────────────────────────────────────────

  /**
   * Compute review SLA compliance metrics across all completed reviews.
   */
  getSLAMetrics(): ReviewSLAMetrics {
    const completed = Array.from(reviewStore.values()).filter(
      (r) => r.reviewCompletedAt !== null,
    );

    if (completed.length === 0) {
      return this.emptySLAMetrics();
    }

    const turnarounds = completed.map((r) => {
      const ms = r.reviewCompletedAt!.getTime() - r.submittedAt.getTime();
      return ms / (1000 * 60 * 60); // hours
    });

    const withinSLA = completed.filter((r) => r.slaMet === true).length;
    const avg = turnarounds.reduce((s, v) => s + v, 0) / turnarounds.length;
    const sorted = [...turnarounds].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    // Group by bounty type
    const byType = new Map<BountyType, { total: number; withinSLA: number; hours: number[] }>();
    for (const r of completed) {
      const entry = byType.get(r.bountyType) ?? { total: 0, withinSLA: 0, hours: [] };
      entry.total += 1;
      if (r.slaMet) entry.withinSLA += 1;
      const hrs = (r.reviewCompletedAt!.getTime() - r.submittedAt.getTime()) / 3_600_000;
      entry.hours.push(hrs);
      byType.set(r.bountyType, entry);
    }

    return {
      totalReviews: completed.length,
      reviewsWithinSLA: withinSLA,
      reviewsBreachedSLA: completed.length - withinSLA,
      slaCompliancePct: (withinSLA / completed.length) * 100,
      avgTurnaroundHours: avg,
      medianTurnaroundHours: median,
      p95TurnaroundHours: p95,
      byBountyType: Array.from(byType.entries()).map(([bountyType, data]) => ({
        bountyType,
        avgTurnaroundHours: data.hours.reduce((s, v) => s + v, 0) / data.hours.length,
        slaCompliancePct: (data.withinSLA / data.total) * 100,
      })),
    };
  }

  /**
   * Compute high-level mentorship metrics: mentor counts, review totals,
   * avg helpfulness score, SLA compliance, and top-performing mentors.
   */
  getMentorshipMetrics(): MentorshipMetrics {
    const allMentors = Array.from(mentorStore.values());
    const activeMentors = allMentors.filter((m) => m.status === 'active');
    const allReviews = Array.from(reviewStore.values());

    const totalHelpfulness = allMentors
      .filter((m) => m.avgHelpfulnessScore > 0)
      .map((m) => m.avgHelpfulnessScore);

    const avgHelpfulness =
      totalHelpfulness.length > 0
        ? totalHelpfulness.reduce((s, v) => s + v, 0) / totalHelpfulness.length
        : 0;

    const topMentors = [...allMentors]
      .sort((a, b) => b.avgHelpfulnessScore - a.avgHelpfulnessScore || b.totalReviews - a.totalReviews)
      .slice(0, 10)
      .map((m) => {
        const mentorReviews = allReviews.filter(
          (r) => r.mentorId === m.publicKey && r.slaMet !== null,
        );
        const withinSLA = mentorReviews.filter((r) => r.slaMet === true).length;
        return {
          mentorId: m.userId,
          publicKey: m.publicKey,
          totalReviews: m.totalReviews,
          avgHelpfulnessScore: m.avgHelpfulnessScore,
          slaCompliancePct:
            mentorReviews.length > 0 ? (withinSLA / mentorReviews.length) * 100 : 0,
        };
      });

    return {
      totalMentors: allMentors.length,
      activeMentors: activeMentors.length,
      totalReviews: allReviews.length,
      avgHelpfulnessScore: avgHelpfulness,
      slaMetrics: this.getSLAMetrics(),
      topMentors,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private requireMentor(publicKey: string): MentorProfile {
    const m = mentorStore.get(publicKey);
    if (!m) {
      throw new NotFoundException(`Mentor profile not found for key: ${publicKey}`);
    }
    return m;
  }

  private requireReview(reviewId: string): ReviewRequest {
    const r = reviewStore.get(reviewId);
    if (!r) {
      throw new NotFoundException(`Review request not found: ${reviewId}`);
    }
    return r;
  }

  /**
   * Select the best available mentor for a given bounty type.
   * Criteria: active status, specializes in the type, has capacity, lowest current load.
   */
  private findAvailableMentor(bountyType: BountyType): MentorProfile | null {
    const candidates = Array.from(mentorStore.values()).filter(
      (m) =>
        m.status === 'active' &&
        m.specializations.includes(bountyType) &&
        m.currentReviewCount < m.reviewCapacityPerWeek,
    );

    if (candidates.length === 0) return null;

    // Prefer mentor with highest reputation and fewest current reviews
    candidates.sort(
      (a, b) =>
        a.currentReviewCount - b.currentReviewCount || b.reputation - a.reputation,
    );

    return candidates[0];
  }

  /**
   * After a review completes, update the assigned mentor's statistics.
   */
  private updateMentorStats(mentorId: string, review: ReviewRequest): void {
    const mentor = mentorStore.get(mentorId);
    if (!mentor) return;

    mentor.totalReviews += 1;
    mentor.currentReviewCount = Math.max(0, mentor.currentReviewCount - 1);
    mentor.lastActiveAt = new Date();

    // Recompute avg turnaround from all completed reviews for this mentor
    const mentorReviews = Array.from(reviewStore.values()).filter(
      (r) => r.mentorId === mentorId && r.reviewCompletedAt !== null,
    );

    if (mentorReviews.length > 0) {
      const totalHrs = mentorReviews.reduce((sum, r) => {
        return sum + (r.reviewCompletedAt!.getTime() - r.submittedAt.getTime()) / 3_600_000;
      }, 0);
      mentor.avgTurnaroundHours = totalHrs / mentorReviews.length;
    }

    mentorStore.set(mentorId, mentor);
  }

  /**
   * Recompute a mentor's average helpfulness score from all mentee feedback.
   */
  private recomputeMentorHelpfulness(mentorId: string): void {
    const mentor = mentorStore.get(mentorId);
    if (!mentor) return;

    const feedbacks = menteeFeedbackStore.get(mentorId) ?? [];
    if (feedbacks.length === 0) return;

    const avg =
      feedbacks.reduce((sum, f) => sum + f.helpfulnessScore, 0) / feedbacks.length;
    mentor.avgHelpfulnessScore = Math.round(avg * 10) / 10;
    mentorStore.set(mentorId, mentor);
  }

  private emptySLAMetrics(): ReviewSLAMetrics {
    return {
      totalReviews: 0,
      reviewsWithinSLA: 0,
      reviewsBreachedSLA: 0,
      slaCompliancePct: 0,
      avgTurnaroundHours: 0,
      medianTurnaroundHours: 0,
      p95TurnaroundHours: 0,
      byBountyType: [],
    };
  }
}
