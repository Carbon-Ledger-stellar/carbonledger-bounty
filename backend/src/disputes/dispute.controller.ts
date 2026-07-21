import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DisputeService } from './dispute.service';
import {
  AddEvidenceDto,
  DisputeQueryDto,
  DisputeStatus,
  ExtendReviewDto,
  FileAppealDto,
  MakeDecisionDto,
  OpenDisputeDto,
} from './dispute.dto';

@Controller('api/v1/disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  // ── Public read endpoints ─────────────────────────────────────────────────

  /**
   * List disputes with optional filters.
   * GET /api/v1/disputes?bountyId=...&status=opened&contributorId=...
   */
  @Get()
  async listDisputes(
    @Query('bountyId') bountyId?: string,
    @Query('contributorId') contributorId?: string,
    @Query('arbitratorId') arbitratorId?: string,
    @Query('status') status?: DisputeStatus,
  ) {
    const query: DisputeQueryDto = { bountyId, contributorId, arbitratorId, status };
    return this.disputeService.findAll(query);
  }

  /**
   * Aggregate statistics (dashboard use).
   * GET /api/v1/disputes/stats
   */
  @Get('stats')
  async getStats() {
    return this.disputeService.getStats();
  }

  /**
   * Get a single dispute with evidence and decisions.
   * GET /api/v1/disputes/:disputeId
   */
  @Get(':disputeId')
  async getDispute(@Param('disputeId') disputeId: string) {
    return this.disputeService.findOne(disputeId);
  }

  /**
   * Get all evidence for a dispute.
   * GET /api/v1/disputes/:disputeId/evidence
   */
  @Get(':disputeId/evidence')
  async getEvidence(@Param('disputeId') disputeId: string) {
    return this.disputeService.getEvidence(disputeId);
  }

  /**
   * Get the full audit trail for a dispute.
   * GET /api/v1/disputes/:disputeId/audit-log
   */
  @Get(':disputeId/audit-log')
  async getAuditLog(@Param('disputeId') disputeId: string) {
    return this.disputeService.getAuditLog(disputeId);
  }

  // ── Authenticated write endpoints ─────────────────────────────────────────

  /**
   * Open a new dispute (contributor whose submission was rejected).
   * POST /api/v1/disputes
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async openDispute(@Body() dto: OpenDisputeDto, @Request() req) {
    return this.disputeService.openDispute(dto, req.user.publicKey);
  }

  /**
   * Arbitrator claims the dispute and starts the review window.
   * PUT /api/v1/disputes/:disputeId/start-review
   */
  @Put(':disputeId/start-review')
  @UseGuards(AuthGuard('jwt'))
  async startReview(@Param('disputeId') disputeId: string, @Request() req) {
    return this.disputeService.startReview(disputeId, req.user.publicKey);
  }

  /**
   * Submit evidence for an open or under-review dispute.
   * POST /api/v1/disputes/:disputeId/evidence
   */
  @Post(':disputeId/evidence')
  @UseGuards(AuthGuard('jwt'))
  async addEvidence(
    @Param('disputeId') disputeId: string,
    @Body() dto: AddEvidenceDto,
    @Request() req,
  ) {
    return this.disputeService.addEvidence(disputeId, dto, req.user.publicKey);
  }

  /**
   * Extend the review window from 7 to 14 days (arbitrator only, once).
   * PUT /api/v1/disputes/:disputeId/extend-review
   */
  @Put(':disputeId/extend-review')
  @UseGuards(AuthGuard('jwt'))
  async extendReview(
    @Param('disputeId') disputeId: string,
    @Body() dto: ExtendReviewDto,
    @Request() req,
  ) {
    return this.disputeService.extendReview(disputeId, dto, req.user.publicKey);
  }

  /**
   * Arbitrator makes a binding decision (approved / rejected / partial).
   * POST /api/v1/disputes/:disputeId/decision
   */
  @Post(':disputeId/decision')
  @UseGuards(AuthGuard('jwt'))
  async makeDecision(
    @Param('disputeId') disputeId: string,
    @Body() dto: MakeDecisionDto,
    @Request() req,
  ) {
    return this.disputeService.makeDecision(disputeId, dto, req.user.publicKey);
  }

  /**
   * Contributor files an appeal (once, must include new evidence).
   * POST /api/v1/disputes/:disputeId/appeal
   */
  @Post(':disputeId/appeal')
  @UseGuards(AuthGuard('jwt'))
  async fileAppeal(
    @Param('disputeId') disputeId: string,
    @Body() dto: FileAppealDto,
    @Request() req,
  ) {
    return this.disputeService.fileAppeal(disputeId, dto, req.user.publicKey);
  }
}
