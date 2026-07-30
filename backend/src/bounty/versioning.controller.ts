import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BountyVersioningService } from './versioning.service';
import { InitBountyVersionDto, ReopenBountyDto, UpdateVersionStatusDto } from './versioning.dto';

@Controller('api/v1/bounties/:bountyId/versions')
export class BountyVersioningController {
  constructor(private readonly versioning: BountyVersioningService) {}

  // ── Public read endpoints ─────────────────────────────────────────────────

  /**
   * Full version history for a bounty (oldest to newest).
   * GET /api/v1/bounties/:bountyId/versions
   */
  @Get()
  async getHistory(@Param('bountyId') bountyId: string) {
    return this.versioning.getVersionHistory(bountyId);
  }

  /**
   * The current (latest) version.
   * GET /api/v1/bounties/:bountyId/versions/current
   */
  @Get('current')
  async getCurrent(@Param('bountyId') bountyId: string) {
    return this.versioning.getCurrentVersion(bountyId);
  }

  /**
   * Audit trail: who reopened, when, and why.
   * GET /api/v1/bounties/:bountyId/versions/audit
   */
  @Get('audit')
  async getAudit(@Param('bountyId') bountyId: string) {
    return this.versioning.getAuditTrail(bountyId);
  }

  // ── Authenticated write endpoints ─────────────────────────────────────────

  /**
   * Create the initial (v1) version for a bounty (maintainer only).
   * POST /api/v1/bounties/:bountyId/versions/init
   */
  @Post('init')
  @UseGuards(AuthGuard('jwt'))
  async init(
    @Param('bountyId') bountyId: string,
    @Body() dto: InitBountyVersionDto,
    @Request() req,
  ) {
    return this.versioning.createInitialVersion(bountyId, dto, req.user.publicKey);
  }

  /**
   * Re-open a closed bounty as a new version (maintainer only).
   * POST /api/v1/bounties/:bountyId/versions/reopen
   */
  @Post('reopen')
  @UseGuards(AuthGuard('jwt'))
  async reopen(
    @Param('bountyId') bountyId: string,
    @Body() dto: ReopenBountyDto,
    @Request() req,
  ) {
    return this.versioning.reopenBounty(bountyId, dto, req.user.publicKey);
  }

  /**
   * Update the status of the current version (maintainer/reviewer only).
   * PUT /api/v1/bounties/:bountyId/versions/status
   */
  @Put('status')
  @UseGuards(AuthGuard('jwt'))
  async updateStatus(
    @Param('bountyId') bountyId: string,
    @Body() dto: UpdateVersionStatusDto,
    @Request() req,
  ) {
    return this.versioning.updateVersionStatus(bountyId, dto, req.user.publicKey);
  }
}
