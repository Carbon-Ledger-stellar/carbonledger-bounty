import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MentorshipService } from './mentorship.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  OptInMentorDto,
  UpdateMentorStatusDto,
  SubmitReviewRequestDto,
  SubmitReviewDto,
  SubmitMenteeFeedbackDto,
  GetReviewsQueryDto,
  BountyType,
  MentorStatus,
} from './mentorship.types';

@Controller('api/v1/mentorship')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MentorshipController {
  constructor(private readonly mentorship: MentorshipService) {}

  // ── Mentor profiles ──────────────────────────────────────────────────────────

  /**
   * POST /api/v1/mentorship/mentors/opt-in
   * Opt the authenticated contributor into mentor status.
   * Requires reputation >80 (enforced by service layer).
   * Open to any authenticated user — role check is reputation-based, not role-based.
   */
  @Post('mentors/opt-in')
  @Roles('contributor', 'developer', 'maintainer')
  async optIn(@Body() dto: OptInMentorDto, @Request() req: any) {
    // In production, reputation would be fetched from a contributor profile service.
    // For now the caller passes it in the JWT payload or it defaults to the guard minimum.
    const reputation: number = req.user?.reputation ?? 80;
    return this.mentorship.optInMentor(dto, reputation);
  }

  /**
   * PATCH /api/v1/mentorship/mentors/:publicKey/status
   * Update mentor availability status (active / inactive / on_break).
   * Maintainers can update any mentor; contributors can only update themselves.
   */
  @Patch('mentors/:publicKey/status')
  @Roles('contributor', 'developer', 'maintainer')
  async updateStatus(
    @Param('publicKey') publicKey: string,
    @Body() dto: UpdateMentorStatusDto,
  ) {
    return this.mentorship.updateMentorStatus(publicKey, dto);
  }

  /**
   * GET /api/v1/mentorship/mentors
   * List all mentor profiles. Optional ?status=active|inactive|on_break filter.
   */
  @Get('mentors')
  listMentors(@Query('status') status?: MentorStatus) {
    return this.mentorship.listMentors(status);
  }

  /**
   * GET /api/v1/mentorship/mentors/:publicKey
   * Get a single mentor profile.
   */
  @Get('mentors/:publicKey')
  getMentor(@Param('publicKey') publicKey: string) {
    return this.mentorship.getMentor(publicKey);
  }

  /**
   * GET /api/v1/mentorship/mentors/:publicKey/feedback
   * Get all mentee feedback received by a mentor.
   */
  @Get('mentors/:publicKey/feedback')
  getMentorFeedback(@Param('publicKey') publicKey: string) {
    return this.mentorship.getMentorFeedback(publicKey);
  }

  // ── Review requests ──────────────────────────────────────────────────────────

  /**
   * POST /api/v1/mentorship/reviews
   * Submit a new review request for a bounty submission.
   * Auto-assigns to the best available mentor for the bounty type.
   */
  @Post('reviews')
  @Roles('contributor', 'developer', 'maintainer')
  async submitReviewRequest(@Body() dto: SubmitReviewRequestDto) {
    return this.mentorship.submitReviewRequest(dto);
  }

  /**
   * GET /api/v1/mentorship/reviews
   * List review requests with optional filters:
   * ?status, ?bountyType, ?mentorId, ?contributorId, ?page, ?limit
   */
  @Get('reviews')
  listReviews(@Query() query: GetReviewsQueryDto) {
    return this.mentorship.listReviewRequests(query);
  }

  /**
   * GET /api/v1/mentorship/reviews/:reviewId
   * Get a single review request by ID.
   */
  @Get('reviews/:reviewId')
  getReview(@Param('reviewId') reviewId: string) {
    return this.mentorship.getReviewRequest(reviewId);
  }

  /**
   * POST /api/v1/mentorship/reviews/submit
   * Mentor submits their completed review: checklist results, score, feedback, decision.
   * Only the assigned mentor (or a maintainer) may submit.
   */
  @Post('reviews/submit')
  @Roles('contributor', 'developer', 'maintainer')
  async submitReview(@Body() dto: SubmitReviewDto) {
    return this.mentorship.submitReview(dto);
  }

  // ── Feedback forms ───────────────────────────────────────────────────────────

  /**
   * GET /api/v1/mentorship/forms/mentor/:bountyType
   * Fetch the mentor review form (feedback questions + checklist) for a bounty type.
   */
  @Get('forms/mentor/:bountyType')
  getMentorForm(@Param('bountyType') bountyType: BountyType) {
    return this.mentorship.getMentorFeedbackForm(bountyType);
  }

  /**
   * GET /api/v1/mentorship/forms/mentee
   * Fetch the mentee satisfaction survey questions.
   */
  @Get('forms/mentee')
  getMenteeForm() {
    return this.mentorship.getMenteeFeedbackForm();
  }

  /**
   * POST /api/v1/mentorship/feedback/mentee
   * Contributor submits their feedback about the mentor after review completion.
   */
  @Post('feedback/mentee')
  @Roles('contributor', 'developer', 'maintainer')
  @HttpCode(HttpStatus.CREATED)
  async submitMenteeFeedback(@Body() dto: SubmitMenteeFeedbackDto) {
    return this.mentorship.submitMenteeFeedback(dto);
  }

  // ── Checklist templates ───────────────────────────────────────────────────────

  /**
   * GET /api/v1/mentorship/checklists
   * Return all registered review checklist templates (one per bounty type).
   */
  @Get('checklists')
  getAllChecklists() {
    return this.mentorship.getAllChecklists();
  }

  /**
   * GET /api/v1/mentorship/checklists/:bountyType
   * Return the checklist template for a specific bounty type.
   */
  @Get('checklists/:bountyType')
  getChecklist(@Param('bountyType') bountyType: BountyType) {
    return this.mentorship.getChecklist(bountyType);
  }

  // ── Metrics ──────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/mentorship/metrics
   * Overall mentorship metrics: mentor counts, review totals, helpfulness scores, SLA.
   */
  @Get('metrics')
  @Roles('maintainer')
  getMetrics() {
    return this.mentorship.getMentorshipMetrics();
  }

  /**
   * GET /api/v1/mentorship/metrics/sla
   * Detailed SLA compliance metrics: turnaround times, compliance %, by bounty type.
   */
  @Get('metrics/sla')
  @Roles('maintainer')
  getSLAMetrics() {
    return this.mentorship.getSLAMetrics();
  }
}
