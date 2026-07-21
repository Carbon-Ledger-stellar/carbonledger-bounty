import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OnboardingService } from './onboarding.service';
import {
  UpdateStepDto,
  SubmitAssessmentDto,
  CheckCertificationDto,
  RecordMentorshipDto,
  OnboardingQueryDto,
  OnboardingStatus,
  CertificationDomain,
} from './onboarding.dto';

@Controller('api/v1/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ── Onboarding progress ───────────────────────────────────────────────────

  /**
   * Start (or retrieve) the authenticated contributor's onboarding.
   * POST /api/v1/onboarding/start
   */
  @Post('start')
  @UseGuards(AuthGuard('jwt'))
  async startOnboarding(@Request() req) {
    return this.onboardingService.startOnboarding(req.user.publicKey);
  }

  /**
   * Get the authenticated contributor's current onboarding progress.
   * GET /api/v1/onboarding/progress
   */
  @Get('progress')
  @UseGuards(AuthGuard('jwt'))
  async getMyProgress(@Request() req) {
    return this.onboardingService.getProgress(req.user.publicKey);
  }

  /**
   * Get any contributor's onboarding progress by their public key (admin / leaderboard).
   * GET /api/v1/onboarding/progress/:contributorId
   */
  @Get('progress/:contributorId')
  async getProgress(@Param('contributorId') contributorId: string) {
    return this.onboardingService.getProgress(contributorId);
  }

  /**
   * List all onboarding progress records, optionally filtered by status.
   * GET /api/v1/onboarding/progress?status=in_progress
   */
  @Get()
  async listProgress(@Query('status') status?: OnboardingStatus) {
    const query: OnboardingQueryDto = { status };
    return this.onboardingService.listProgress(query);
  }

  /**
   * Update a step on the authenticated contributor's onboarding.
   * PUT /api/v1/onboarding/steps
   */
  @Put('steps')
  @UseGuards(AuthGuard('jwt'))
  async updateStep(@Body() dto: UpdateStepDto, @Request() req) {
    return this.onboardingService.updateStep(req.user.publicKey, dto);
  }

  // ── Skill assessments ─────────────────────────────────────────────────────

  /**
   * List all available skill assessments, optionally filtered by domain.
   * GET /api/v1/onboarding/assessments?domain=backend
   */
  @Get('assessments')
  async listAssessments(@Query('domain') domain?: string) {
    return this.onboardingService.listAssessments(domain);
  }

  /**
   * Submit a score for a skill assessment attempt.
   * POST /api/v1/onboarding/assessments/submit
   */
  @Post('assessments/submit')
  @UseGuards(AuthGuard('jwt'))
  async submitAssessment(@Body() dto: SubmitAssessmentDto, @Request() req) {
    return this.onboardingService.submitAssessment(req.user.publicKey, dto);
  }

  /**
   * Get all assessment attempts for the authenticated contributor.
   * GET /api/v1/onboarding/assessments/attempts
   */
  @Get('assessments/attempts')
  @UseGuards(AuthGuard('jwt'))
  async getMyAttempts(@Request() req) {
    return this.onboardingService.getAttempts(req.user.publicKey);
  }

  /**
   * Get assessment attempts for any contributor (admin view).
   * GET /api/v1/onboarding/assessments/attempts/:contributorId
   */
  @Get('assessments/attempts/:contributorId')
  async getAttempts(@Param('contributorId') contributorId: string) {
    return this.onboardingService.getAttempts(contributorId);
  }

  // ── Certifications ────────────────────────────────────────────────────────

  /**
   * Get all certifications for the authenticated contributor.
   * GET /api/v1/onboarding/certifications
   */
  @Get('certifications')
  @UseGuards(AuthGuard('jwt'))
  async getMyCertifications(@Request() req) {
    return this.onboardingService.getCertifications(req.user.publicKey);
  }

  /**
   * Get all certifications for any contributor (public).
   * GET /api/v1/onboarding/certifications/:contributorId
   */
  @Get('certifications/:contributorId')
  async getCertifications(@Param('contributorId') contributorId: string) {
    return this.onboardingService.getCertifications(contributorId);
  }

  /**
   * Check whether a contributor holds a valid certification for a domain.
   * POST /api/v1/onboarding/certifications/check
   */
  @Post('certifications/check')
  async checkCertification(@Body() dto: CheckCertificationDto) {
    return this.onboardingService.checkCertification(dto);
  }

  // ── Locked bounties ───────────────────────────────────────────────────────

  /**
   * List all bounties that require a certification to apply.
   * GET /api/v1/onboarding/locked-bounties
   */
  @Get('locked-bounties')
  listLockedBounties() {
    return this.onboardingService.listLockedBounties();
  }

  /**
   * Register a bounty as requiring a certification (maintainer only).
   * POST /api/v1/onboarding/locked-bounties
   */
  @Post('locked-bounties')
  @UseGuards(AuthGuard('jwt'))
  lockBounty(
    @Body('bountyId') bountyId: string,
    @Body('domain') domain: CertificationDomain,
  ) {
    this.onboardingService.lockBounty(bountyId, domain);
    return { bountyId, domain, locked: true };
  }

  /**
   * Remove a bounty's certification requirement (maintainer only).
   * DELETE /api/v1/onboarding/locked-bounties/:bountyId
   */
  @Delete('locked-bounties/:bountyId')
  @UseGuards(AuthGuard('jwt'))
  unlockBounty(@Param('bountyId') bountyId: string) {
    this.onboardingService.unlockBounty(bountyId);
    return { bountyId, locked: false };
  }

  /**
   * Check if the authenticated contributor can apply to a given bounty.
   * GET /api/v1/onboarding/bounty-access/:bountyId
   */
  @Get('bounty-access/:bountyId')
  @UseGuards(AuthGuard('jwt'))
  async checkBountyAccess(
    @Param('bountyId') bountyId: string,
    @Request() req,
  ) {
    return this.onboardingService.checkBountyAccess(bountyId, req.user.publicKey);
  }

  // ── Badges ────────────────────────────────────────────────────────────────

  /**
   * Get all badges for the authenticated contributor.
   * GET /api/v1/onboarding/badges
   */
  @Get('badges')
  @UseGuards(AuthGuard('jwt'))
  async getMyBadges(@Request() req) {
    return this.onboardingService.getBadges(req.user.publicKey);
  }

  /**
   * Get all badges for any contributor (public leaderboard).
   * GET /api/v1/onboarding/badges/:contributorId
   */
  @Get('badges/:contributorId')
  async getBadges(@Param('contributorId') contributorId: string) {
    return this.onboardingService.getBadges(contributorId);
  }

  // ── Mentorship ────────────────────────────────────────────────────────────

  /**
   * Record a mentorship event (mentor is the authenticated contributor).
   * POST /api/v1/onboarding/mentorship
   */
  @Post('mentorship')
  @UseGuards(AuthGuard('jwt'))
  async recordMentorship(@Body() dto: RecordMentorshipDto, @Request() req) {
    return this.onboardingService.recordMentorship(req.user.publicKey, dto);
  }
}
