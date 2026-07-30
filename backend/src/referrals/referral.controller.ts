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
import {
  BountyCompletedDto,
  CohortQueryDto,
  RegisterContributorDto,
  TopReferrersQueryDto,
} from './referral.dto';
import { ReferralService } from './referral.service';

/**
 * All endpoints under /api/v1/referrals.
 *
 * Auth policy:
 *   - Registration and bounty-completion notification require a valid JWT
 *     (contributor must be authenticated).
 *   - Stats / reports require auth to prevent scraping referral codes.
 */
@Controller('api/v1/referrals')
@UseGuards(AuthGuard('jwt'))
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  // ── Registration ─────────────────────────────────────────────────────────

  /**
   * POST /api/v1/referrals/register
   *
   * Registers a new contributor.  Pass an optional `referralCode` if the user
   * arrived via an invite link (?ref=<code>).
   *
   * @example
   * POST /api/v1/referrals/register
   * { "userId": "clxyz...", "referralCode": "ABCD1234" }
   */
  @Post('register')
  register(@Body() dto: RegisterContributorDto) {
    return this.referralService.registerContributor(dto);
  }

  // ── Bounty-completion hook ────────────────────────────────────────────────

  /**
   * POST /api/v1/referrals/bounty-completed
   *
   * Called by the bounty payout flow (or an admin script) once a bounty reward
   * is confirmed. Triggers referral-bonus calculation and milestone checks.
   *
   * Returns the newly created ReferralBonus record, or null if no bonus applies.
   */
  @Post('bounty-completed')
  bountyCompleted(@Body() dto: BountyCompletedDto) {
    return this.referralService.onBountyCompleted(dto);
  }

  // ── Stats for a single contributor ──────────────────────────────────────

  /**
   * GET /api/v1/referrals/stats/:contributorId
   *
   * Returns the referral dashboard for a contributor:
   * total referrals, active referrals, pending/paid bonuses, and milestones.
   */
  @Get('stats/:contributorId')
  getStats(@Param('contributorId') contributorId: string) {
    return this.referralService.getReferralStats(contributorId);
  }

  // ── Cohort analysis ──────────────────────────────────────────────────────

  /**
   * GET /api/v1/referrals/cohorts
   *
   * Monthly cohort analysis of referred contributors.
   * Measures engagement: how many completed at least one bounty within their
   * cohort (sign-up month × referrer).
   *
   * @query since   ISO 8601 date – lower bound (default: 90 days ago)
   * @query page    page number (default: 1)
   * @query limit   results per page (default: 20, max: 100)
   */
  @Get('cohorts')
  getCohorts(@Query() query: CohortQueryDto) {
    return this.referralService.getCohortAnalysis(query);
  }

  // ── Reports ──────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/referrals/top-referrers
   *
   * Leaderboard of contributors ranked by total bonus earned.
   * Includes active-referral count and referral code for each.
   *
   * @query limit   max rows to return (default: 10, max: 100)
   */
  @Get('top-referrers')
  getTopReferrers(@Query() query: TopReferrersQueryDto) {
    return this.referralService.getTopReferrers(query);
  }

  /**
   * GET /api/v1/referrals/retention
   *
   * Compares retention (% who complete ≥1 bounty) of referred vs. organic
   * contributors over a configurable time window.
   *
   * @query since   ISO 8601 date string (default: 90 days ago)
   */
  @Get('retention')
  getRetention(@Query('since') since?: string) {
    return this.referralService.getReferralRetentionReport(since);
  }
}
