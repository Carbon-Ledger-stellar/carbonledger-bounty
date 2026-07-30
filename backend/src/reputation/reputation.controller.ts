import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReputationService } from './reputation.service';
import {
  RecordBountyCompletionDto,
  SubmitPeerRatingDto,
  UpsertContributorDto,
  LeaderboardQueryDto,
  LeaderboardSort,
} from './reputation.dto';

@Controller('api/v1/reputation')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  // ── Public read endpoints ────────────────────────────────────────────────

  /**
   * GET /api/v1/reputation/leaderboard
   *
   * Global contributor leaderboard with optional dimension-based sorting.
   * Query params: sort (reputation|codeQuality|timeliness|communication|peerFeedback),
   *               order (asc|desc), page, limit
   */
  @Get('leaderboard')
  async getLeaderboard(
    @Query('sort') sort?: LeaderboardSort,
    @Query('order') order?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query: LeaderboardQueryDto = {
      sort,
      order,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    };
    return this.reputationService.getLeaderboard(query);
  }

  /**
   * GET /api/v1/reputation/:walletAddress
   *
   * Full reputation breakdown for the dashboard:
   * - Overall score (0-100) and tier
   * - Per-dimension scores with weights and weighted contributions
   * - Stats (bounties completed, on-time rate)
   * - Personalised improvement targets (recovery path for low scores)
   * - Trend direction (improving / stable / declining)
   */
  @Get(':walletAddress')
  async getBreakdown(@Param('walletAddress') walletAddress: string) {
    return this.reputationService.getReputationBreakdown(walletAddress);
  }

  /**
   * GET /api/v1/reputation/:walletAddress/history
   *
   * Paginated history of score changes.  Useful for trend charts.
   * Query params: limit (default 20), offset (default 0)
   */
  @Get(':walletAddress/history')
  async getHistory(
    @Param('walletAddress') walletAddress: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.reputationService.getHistory(
      walletAddress,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
    );
  }

  // ── Protected write endpoints (JWT required) ─────────────────────────────

  /**
   * POST /api/v1/reputation/contributors
   *
   * Register or update a contributor profile.
   * Should be called when a user first interacts with the bounty system.
   */
  @Post('contributors')
  @UseGuards(AuthGuard('jwt'))
  async upsertContributor(@Body() dto: UpsertContributorDto) {
    return this.reputationService.upsertContributor(dto);
  }

  /**
   * POST /api/v1/reputation/bounty-completion
   *
   * Record all reputation signals from a completed bounty and immediately
   * recalculate the contributor's multi-dimensional reputation score.
   *
   * This is the primary trigger for reputation updates — call it once a
   * bounty reaches "completed" status and all review signals are available.
   *
   * Body:
   *   walletAddress    — contributor's Stellar public key
   *   bountyId         — bounty identifier (for audit trail)
   *   reviewerScore    — 1–5 code quality score assigned by reviewer
   *   submittedAt      — ISO 8601 actual submission timestamp
   *   deadlineAt       — ISO 8601 original deadline timestamp
   *   avgResponseHours — avg hours between reviewer comment and contributor reply
   *   peerRating?      — optional 1–5 community/peer rating
   */
  @Post('bounty-completion')
  @UseGuards(AuthGuard('jwt'))
  async recordBountyCompletion(@Body() dto: RecordBountyCompletionDto) {
    return this.reputationService.recordBountyCompletion(dto);
  }

  /**
   * POST /api/v1/reputation/peer-rating
   *
   * Submit a standalone peer/community rating for a contributor.
   * Does not require a bounty completion event; updates peerFeedbackScore only.
   *
   * Body:
   *   walletAddress — target contributor's wallet
   *   bountyId?     — optional bounty context
   *   rating        — 1–5 score
   *   comment?      — optional free-text rationale
   */
  @Post('peer-rating')
  @UseGuards(AuthGuard('jwt'))
  async submitPeerRating(@Body() dto: SubmitPeerRatingDto) {
    return this.reputationService.submitPeerRating(dto);
  }
}
