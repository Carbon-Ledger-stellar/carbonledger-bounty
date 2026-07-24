import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EscrowService } from './escrow.service';
import {
  AddMilestoneDto,
  ApproveMilestoneDto,
  AuditQueryDto,
  CreateEscrowDto,
  MilestoneQueryDto,
  RejectMilestoneDto,
  StartReworkDto,
  SubmitMilestoneDto,
} from './escrow.dto';

/**
 * Milestone-based escrow payment endpoints.
 *
 * All write endpoints require a valid JWT. The authenticated user's
 * `publicKey` is used as the actorId / reviewerAddress throughout.
 *
 * Base route: /api/v1/bounties/:bountyId/escrow
 */
@Controller('api/v1/bounties/:bountyId/escrow')
export class MilestoneController {
  constructor(private readonly escrow: EscrowService) {}

  // ── Escrow account ────────────────────────────────────────────────────────

  /**
   * Create the escrow account for a bounty together with its initial milestones.
   * POST /api/v1/bounties/:bountyId/escrow
   *
   * Body: CreateEscrowDto (totalAmount + milestones array).
   * Sum of milestone paymentAmounts must equal totalAmount.
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async createEscrow(
    @Param('bountyId') bountyId: string,
    @Body() dto: CreateEscrowDto,
    @Request() req,
  ) {
    // Ensure the bountyId in the URL matches the DTO, favouring the URL param
    dto.bountyId = bountyId;
    return this.escrow.createEscrow(dto, req.user.publicKey);
  }

  /**
   * Get the escrow account for a bounty.
   * GET /api/v1/bounties/:bountyId/escrow
   */
  @Get()
  async getEscrow(@Param('bountyId') bountyId: string) {
    return this.escrow.findEscrowByBounty(bountyId);
  }

  /**
   * Cancel an active escrow (no milestones approved/released yet).
   * DELETE /api/v1/bounties/:bountyId/escrow
   */
  @Delete()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async cancelEscrow(@Param('bountyId') bountyId: string, @Request() req) {
    return this.escrow.cancelEscrow(bountyId, req.user.publicKey);
  }

  // ── Milestones ────────────────────────────────────────────────────────────

  /**
   * List milestones for a bounty.
   * GET /api/v1/bounties/:bountyId/escrow/milestones
   *
   * Optional query params: status, reviewerAddress
   */
  @Get('milestones')
  async listMilestones(
    @Param('bountyId') bountyId: string,
    @Query() query: MilestoneQueryDto,
  ) {
    return this.escrow.listMilestones(bountyId, query);
  }

  /**
   * Add a new milestone to an existing active escrow.
   * POST /api/v1/bounties/:bountyId/escrow/milestones
   */
  @Post('milestones')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async addMilestone(
    @Param('bountyId') bountyId: string,
    @Body() dto: AddMilestoneDto,
    @Request() req,
  ) {
    return this.escrow.addMilestone(bountyId, dto, req.user.publicKey);
  }

  /**
   * Get a single milestone.
   * GET /api/v1/bounties/:bountyId/escrow/milestones/:milestoneId
   */
  @Get('milestones/:milestoneId')
  async getMilestone(
    @Param('bountyId') bountyId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.escrow.getMilestone(bountyId, milestoneId);
  }

  // ── Milestone state transitions ───────────────────────────────────────────

  /**
   * Contributor submits a milestone for review.
   * Starts the 7-day reviewer timeout clock.
   * POST /api/v1/bounties/:bountyId/escrow/milestones/:milestoneId/submit
   *
   * Transitions: planned → in-review
   */
  @Post('milestones/:milestoneId/submit')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('bountyId') bountyId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: SubmitMilestoneDto,
    @Request() req,
  ) {
    return this.escrow.submitMilestone(bountyId, milestoneId, dto, req.user.publicKey);
  }

  /**
   * Reviewer approves a milestone; funds are queued for release.
   * PUT /api/v1/bounties/:bountyId/escrow/milestones/:milestoneId/approve
   *
   * Caller must be the reviewerAddress assigned to this milestone.
   * Transitions: in-review → approved
   */
  @Put('milestones/:milestoneId/approve')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('bountyId') bountyId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: ApproveMilestoneDto,
    @Request() req,
  ) {
    return this.escrow.approveMilestone(bountyId, milestoneId, dto, req.user.publicKey);
  }

  /**
   * Reviewer rejects a milestone with mandatory written feedback.
   * Triggers the re-work cycle.
   * PUT /api/v1/bounties/:bountyId/escrow/milestones/:milestoneId/reject
   *
   * Caller must be the reviewerAddress assigned to this milestone.
   * Transitions: in-review → rejected
   */
  @Put('milestones/:milestoneId/reject')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('bountyId') bountyId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: RejectMilestoneDto,
    @Request() req,
  ) {
    return this.escrow.rejectMilestone(bountyId, milestoneId, dto, req.user.publicKey);
  }

  /**
   * Contributor acknowledges rejection and resets milestone for re-work.
   * POST /api/v1/bounties/:bountyId/escrow/milestones/:milestoneId/rework
   *
   * Transitions: rejected → planned
   * After this call the contributor can revise their work and re-submit.
   */
  @Post('milestones/:milestoneId/rework')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async startRework(
    @Param('bountyId') bountyId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: StartReworkDto,
    @Request() req,
  ) {
    return this.escrow.startRework(bountyId, milestoneId, dto, req.user.publicKey);
  }

  /**
   * Release funds for an approved milestone to the contributor.
   * POST /api/v1/bounties/:bountyId/escrow/milestones/:milestoneId/release
   *
   * Transitions: approved → funds-released
   * When all milestones reach funds-released the escrow status becomes 'completed'.
   */
  @Post('milestones/:milestoneId/release')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async release(
    @Param('bountyId') bountyId: string,
    @Param('milestoneId') milestoneId: string,
    @Request() req,
  ) {
    return this.escrow.releaseFunds(bountyId, milestoneId, req.user.publicKey, false);
  }

  // ── Audit trail ───────────────────────────────────────────────────────────

  /**
   * Retrieve the full audit trail for this bounty's escrow.
   * GET /api/v1/bounties/:bountyId/escrow/audit
   *
   * Optional query params: milestoneId, actorId, action, limit
   */
  @Get('audit')
  async getAuditLog(
    @Param('bountyId') bountyId: string,
    @Query() query: AuditQueryDto,
  ) {
    return this.escrow.getAuditLog(bountyId, query);
  }
}
