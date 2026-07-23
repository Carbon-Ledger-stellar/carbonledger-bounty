import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GithubService } from './github.service';
import { CreateBountyFromIssueDto, GithubWebhookEventDto, LinkPullRequestDto } from './github.dto';

@Controller('api/v1/integrations/github')
export class GithubController {
  constructor(private readonly github: GithubService) {}

  // ── Public read endpoints ─────────────────────────────────────────────────

  @Get('bounties')
  async listBounties() {
    return this.github.listBounties();
  }

  @Get('bounties/:bountyId')
  async getBounty(@Param('bountyId') bountyId: string) {
    return this.github.getBounty(bountyId);
  }

  // ── Authenticated write endpoints ─────────────────────────────────────────

  /**
   * Create a bounty from a GitHub issue (maintainer only).
   * POST /api/v1/integrations/github/bounties
   */
  @Post('bounties')
  @UseGuards(AuthGuard('jwt'))
  async createFromIssue(@Body() dto: CreateBountyFromIssueDto) {
    return this.github.createFromIssue(dto);
  }

  /**
   * Link a pull request to a GitHub-synced bounty (maintainer/contributor).
   * POST /api/v1/integrations/github/link-pr
   */
  @Post('link-pr')
  @UseGuards(AuthGuard('jwt'))
  async linkPullRequest(@Body() dto: LinkPullRequestDto) {
    return this.github.linkPullRequest(dto);
  }

  /**
   * Maintainer approves a bounty's completed work; closes the linked issue.
   * POST /api/v1/integrations/github/bounties/:bountyId/approve
   */
  @Post('bounties/:bountyId/approve')
  @UseGuards(AuthGuard('jwt'))
  async approveBounty(@Param('bountyId') bountyId: string) {
    return this.github.approveBounty(bountyId);
  }

  // ── Webhook receiver ─────────────────────────────────────────────────────

  /**
   * Receives GitHub webhook events (issues, pull_request, issue_comment).
   * GitHub App permissions and webhook signature verification are assumed to
   * be handled upstream of this handler (out of scope for this integration).
   * POST /api/v1/integrations/github/webhook
   */
  @Post('webhook')
  async webhook(@Body() dto: GithubWebhookEventDto) {
    const bounty = this.github.handleWebhookEvent(dto);
    return { synced: bounty !== null, bounty };
  }
}
