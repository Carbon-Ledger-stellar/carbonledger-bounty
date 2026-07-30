import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CreateBountyFromIssueDto,
  GithubLinkedBounty,
  GithubSyncAction,
  GithubWebhookEventDto,
  LinkPullRequestDto,
} from './github.dto';

/** Matches "closes #12", "fixes #7", "resolved #3", etc. in a PR body. */
const CLOSES_ISSUE_RE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function issueKey(repoFullName: string, issueNumber: number): string {
  return `${repoFullName}#${issueNumber}`;
}

/**
 * GitHub issues/PR integration: create a bounty from a GitHub issue, keep its
 * status in sync as PRs are linked/opened/merged, and react to inbound
 * webhook events.
 *
 * Self-contained in-memory store (mirrors the pattern used elsewhere in
 * src/bounty and src/bounties) — not wired into the main BountiesService so
 * this module stays independent and easy to test.
 *
 * Out of scope (per issue): GitHub App permissions and webhook signature
 * verification are assumed to be handled upstream of this handler.
 */
@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  private bounties: Map<string, GithubLinkedBounty> = new Map();

  /** repo#issueNumber -> bountyId, for webhook lookups */
  private byIssue: Map<string, string> = new Map();

  /** Outbound sync actions recorded instead of real GitHub API calls. */
  private syncActions: GithubSyncAction[] = [];

  // ── Create from issue ────────────────────────────────────────────────────

  createFromIssue(dto: CreateBountyFromIssueDto): GithubLinkedBounty {
    const key = issueKey(dto.repoFullName, dto.issueNumber);
    if (this.byIssue.has(key)) {
      throw new BadRequestException(
        `A bounty is already linked to ${dto.repoFullName}#${dto.issueNumber}`,
      );
    }

    const now = new Date();
    const bounty: GithubLinkedBounty = {
      bountyId: generateId('gh-bounty'),
      title: dto.issueTitle,
      description: dto.issueBody,
      tags: this.mapLabelsToTags(dto.labels ?? []),
      status: 'open',
      repoFullName: dto.repoFullName,
      issueNumber: dto.issueNumber,
      issueUrl: dto.issueUrl,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
    };

    this.bounties.set(bounty.bountyId, bounty);
    this.byIssue.set(key, bounty.bountyId);

    this.logger.log(`Bounty ${bounty.bountyId} created from ${key}: "${dto.issueTitle}"`);
    return bounty;
  }

  // ── Link a PR ─────────────────────────────────────────────────────────────

  linkPullRequest(dto: LinkPullRequestDto): GithubLinkedBounty {
    const bounty = this.getBountyOrThrow(dto.bountyId);

    bounty.prUrl = dto.prUrl;
    bounty.prNumber = dto.prNumber;
    if (bounty.status !== 'closed') {
      bounty.status = 'in_progress';
    }
    this.touch(bounty);

    this.logger.log(`PR ${dto.prUrl} linked to bounty ${bounty.bountyId} -> in_progress`);
    return bounty;
  }

  // ── Webhook handling ──────────────────────────────────────────────────────

  /**
   * Dispatch an inbound webhook event, syncing bounty status accordingly.
   * Returns null (and logs) if no bounty is linked to the referenced issue —
   * webhooks may arrive for issues/PRs this system doesn't track.
   */
  handleWebhookEvent(dto: GithubWebhookEventDto): GithubLinkedBounty | null {
    switch (dto.event) {
      case 'issues':
        return this.handleIssueEvent(dto);
      case 'pull_request':
        return this.handlePullRequestEvent(dto);
      case 'issue_comment':
        return this.handleIssueCommentEvent(dto);
      default:
        return null;
    }
  }

  private handleIssueEvent(dto: GithubWebhookEventDto): GithubLinkedBounty | null {
    if (dto.issueNumber == null) return null;
    const bounty = this.findByIssue(dto.repoFullName, dto.issueNumber);
    if (!bounty) {
      this.logger.warn(`No bounty linked to ${issueKey(dto.repoFullName, dto.issueNumber)}`);
      return null;
    }

    if (dto.action === 'closed') {
      bounty.status = 'closed';
    } else if (dto.action === 'reopened') {
      bounty.status = 'open';
    }

    this.touch(bounty);
    return bounty;
  }

  private handlePullRequestEvent(dto: GithubWebhookEventDto): GithubLinkedBounty | null {
    let bounty = dto.prNumber != null ? this.findByPr(dto.prNumber, dto.repoFullName) : undefined;

    // Auto-link on first sight via a "closes #N" reference in the PR body.
    if (!bounty && dto.body) {
      const match = dto.body.match(CLOSES_ISSUE_RE);
      if (match) {
        bounty = this.findByIssue(dto.repoFullName, Number(match[1]));
        if (bounty && dto.prNumber != null) {
          bounty.prNumber = dto.prNumber;
          bounty.prUrl = dto.prUrl ?? bounty.prUrl;
        }
      }
    }

    if (!bounty) {
      this.logger.warn(
        `No bounty linked to PR #${dto.prNumber ?? '?'} in ${dto.repoFullName}`,
      );
      return null;
    }

    if (dto.action === 'opened') {
      bounty.status = 'in_progress';
    } else if (dto.action === 'closed' && dto.merged) {
      bounty.status = 'review';
    }
    // closed && !merged (PR rejected/abandoned) is left as-is — a maintainer decides next steps.

    this.touch(bounty);
    return bounty;
  }

  private handleIssueCommentEvent(dto: GithubWebhookEventDto): GithubLinkedBounty | null {
    if (dto.issueNumber == null) return null;
    const bounty = this.findByIssue(dto.repoFullName, dto.issueNumber);
    if (!bounty) return null;

    // Comments don't change status; just record sync activity for consistency.
    this.touch(bounty);
    return bounty;
  }

  // ── Bounty approval → sync back to GitHub ───────────────────────────────

  /**
   * Bounty approved: mark closed and record the corresponding GitHub sync
   * action (closing the issue). No real GitHub API call is made here.
   */
  approveBounty(bountyId: string): GithubLinkedBounty {
    const bounty = this.getBountyOrThrow(bountyId);
    bounty.status = 'closed';
    this.touch(bounty);

    this.syncActions.push({
      action: 'close_issue',
      repoFullName: bounty.repoFullName,
      issueNumber: bounty.issueNumber,
      createdAt: new Date(),
    });

    this.logger.log(`Bounty ${bountyId} approved -> closing ${bounty.repoFullName}#${bounty.issueNumber}`);
    return bounty;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  getBounty(bountyId: string): GithubLinkedBounty {
    return this.getBountyOrThrow(bountyId);
  }

  listBounties(): GithubLinkedBounty[] {
    return Array.from(this.bounties.values());
  }

  getSyncActions(): GithubSyncAction[] {
    return this.syncActions;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private getBountyOrThrow(bountyId: string): GithubLinkedBounty {
    const bounty = this.bounties.get(bountyId);
    if (!bounty) throw new NotFoundException(`No GitHub-linked bounty ${bountyId}`);
    return bounty;
  }

  private findByIssue(repoFullName: string, issueNumber: number): GithubLinkedBounty | undefined {
    const id = this.byIssue.get(issueKey(repoFullName, issueNumber));
    return id ? this.bounties.get(id) : undefined;
  }

  private findByPr(prNumber: number, repoFullName: string): GithubLinkedBounty | undefined {
    return Array.from(this.bounties.values()).find(
      b => b.prNumber === prNumber && b.repoFullName === repoFullName,
    );
  }

  private touch(bounty: GithubLinkedBounty): void {
    const now = new Date();
    bounty.updatedAt = now;
    bounty.lastSyncedAt = now;
    this.bounties.set(bounty.bountyId, bounty);
  }

  /** "difficulty:hard" -> "hard"; other labels pass through lower-cased. */
  private mapLabelsToTags(labels: string[]): string[] {
    const tags = labels.map(label => {
      const match = label.match(/^difficulty:(.+)$/i);
      return (match ? match[1] : label).toLowerCase();
    });
    return Array.from(new Set(tags));
  }
}
