import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

// ── Value types ──────────────────────────────────────────────────────────────

export type GithubBountyStatus = 'open' | 'in_progress' | 'review' | 'closed';

export type GithubWebhookEvent = 'issues' | 'pull_request' | 'issue_comment';

/**
 * A bounty created from (and kept in sync with) a GitHub issue.
 */
export interface GithubLinkedBounty {
  bountyId: string;
  title: string;
  description: string;
  tags: string[];
  status: GithubBountyStatus;
  repoFullName: string;
  issueNumber: number;
  issueUrl: string;
  prUrl?: string;
  prNumber?: number;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt: Date;
}

/** Outbound sync action recorded instead of an actual GitHub API call. */
export interface GithubSyncAction {
  action: 'close_issue' | 'comment_issue';
  repoFullName: string;
  issueNumber: number;
  createdAt: Date;
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

/**
 * Create a bounty from a GitHub issue.
 * Issue title -> bounty title, body -> description, labels -> tags.
 */
export class CreateBountyFromIssueDto {
  @IsString()
  repoFullName: string;

  @IsNumber()
  issueNumber: number;

  @IsString()
  issueTitle: string;

  @IsString()
  issueBody: string;

  @IsString()
  issueUrl: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];
}

/** Link a pull request to an existing GitHub-synced bounty. */
export class LinkPullRequestDto {
  @IsString()
  bountyId: string;

  @IsString()
  prUrl: string;

  @IsNumber()
  prNumber: number;
}

/**
 * Incoming webhook payload (simplified — GitHub App permissions and webhook
 * signature verification are assumed to be handled upstream of this handler).
 */
export class GithubWebhookEventDto {
  @IsIn(['issues', 'pull_request', 'issue_comment'])
  event: GithubWebhookEvent;

  @IsString()
  action: string;

  @IsString()
  repoFullName: string;

  @IsOptional()
  @IsNumber()
  issueNumber?: number;

  @IsOptional()
  @IsNumber()
  prNumber?: number;

  @IsOptional()
  @IsString()
  prUrl?: string;

  @IsOptional()
  @IsBoolean()
  merged?: boolean;

  /** PR/issue body — scanned for "closes #N" / "fixes #N" to auto-link a PR to its bounty. */
  @IsOptional()
  @IsString()
  body?: string;
}
