import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GithubService } from './github.service';

describe('GithubService', () => {
  let service: GithubService;

  beforeEach(() => {
    service = new GithubService();
  });

  // ── Create from issue ────────────────────────────────────────────────────

  describe('createFromIssue', () => {
    it('maps issue title/body to bounty title/description', () => {
      const bounty = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 12,
        issueTitle: 'Fix pagination bug',
        issueBody: 'The API returns duplicate rows on page 2.',
        issueUrl: 'https://github.com/org/repo/issues/12',
      });

      expect(bounty.title).toBe('Fix pagination bug');
      expect(bounty.description).toBe('The API returns duplicate rows on page 2.');
      expect(bounty.status).toBe('open');
      expect(bounty.issueNumber).toBe(12);
    });

    it("maps GitHub labels to bounty tags, e.g. 'difficulty:hard' -> 'hard'", () => {
      const bounty = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 13,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/13',
        labels: ['difficulty:hard', 'bounty', 'Backend'],
      });

      expect(bounty.tags).toEqual(['hard', 'bounty', 'backend']);
    });

    it('rejects creating a second bounty for the same issue', () => {
      service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 14,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/14',
      });

      expect(() =>
        service.createFromIssue({
          repoFullName: 'org/repo',
          issueNumber: 14,
          issueTitle: 'T2',
          issueBody: 'D2',
          issueUrl: 'https://github.com/org/repo/issues/14',
        }),
      ).toThrow(BadRequestException);
    });
  });

  // ── Link PR ───────────────────────────────────────────────────────────────

  describe('linkPullRequest', () => {
    it('stores the PR URL and moves the bounty to in_progress', () => {
      const created = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 20,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/20',
      });

      const linked = service.linkPullRequest({
        bountyId: created.bountyId,
        prUrl: 'https://github.com/org/repo/pull/99',
        prNumber: 99,
      });

      expect(linked.prUrl).toBe('https://github.com/org/repo/pull/99');
      expect(linked.prNumber).toBe(99);
      expect(linked.status).toBe('in_progress');
    });

    it('throws NotFoundException for an unknown bounty', () => {
      expect(() =>
        service.linkPullRequest({ bountyId: 'nope', prUrl: 'x', prNumber: 1 }),
      ).toThrow(NotFoundException);
    });
  });

  // ── Webhook: issues ───────────────────────────────────────────────────────

  describe('handleWebhookEvent — issues', () => {
    it('closes the bounty when the GitHub issue is closed', () => {
      const created = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 30,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/30',
      });

      const result = service.handleWebhookEvent({
        event: 'issues',
        action: 'closed',
        repoFullName: 'org/repo',
        issueNumber: 30,
      });

      expect(result?.bountyId).toBe(created.bountyId);
      expect(result?.status).toBe('closed');
    });

    it('reopens the bounty when the GitHub issue is reopened', () => {
      service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 31,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/31',
      });
      service.handleWebhookEvent({ event: 'issues', action: 'closed', repoFullName: 'org/repo', issueNumber: 31 });

      const result = service.handleWebhookEvent({
        event: 'issues',
        action: 'reopened',
        repoFullName: 'org/repo',
        issueNumber: 31,
      });

      expect(result?.status).toBe('open');
    });

    it('returns null for a webhook referencing an untracked issue', () => {
      const result = service.handleWebhookEvent({
        event: 'issues',
        action: 'closed',
        repoFullName: 'org/repo',
        issueNumber: 999,
      });
      expect(result).toBeNull();
    });
  });

  // ── Webhook: pull_request ─────────────────────────────────────────────────

  describe('handleWebhookEvent — pull_request', () => {
    it('sets status in_progress when a linked PR is opened', () => {
      const created = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 40,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/40',
      });
      service.linkPullRequest({ bountyId: created.bountyId, prUrl: 'u', prNumber: 100 });

      const result = service.handleWebhookEvent({
        event: 'pull_request',
        action: 'opened',
        repoFullName: 'org/repo',
        prNumber: 100,
      });

      expect(result?.status).toBe('in_progress');
    });

    it('sets status to review when the PR is merged', () => {
      const created = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 41,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/41',
      });
      service.linkPullRequest({ bountyId: created.bountyId, prUrl: 'u', prNumber: 101 });

      const result = service.handleWebhookEvent({
        event: 'pull_request',
        action: 'closed',
        repoFullName: 'org/repo',
        prNumber: 101,
        merged: true,
      });

      expect(result?.status).toBe('review');
    });

    it('leaves status unchanged when a PR is closed without merging', () => {
      const created = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 42,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/42',
      });
      service.linkPullRequest({ bountyId: created.bountyId, prUrl: 'u', prNumber: 102 });

      const result = service.handleWebhookEvent({
        event: 'pull_request',
        action: 'closed',
        repoFullName: 'org/repo',
        prNumber: 102,
        merged: false,
      });

      expect(result?.status).toBe('in_progress');
    });

    it('auto-links a PR to its bounty via a "Closes #N" reference in the body', () => {
      const created = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 50,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/50',
      });

      const result = service.handleWebhookEvent({
        event: 'pull_request',
        action: 'opened',
        repoFullName: 'org/repo',
        prNumber: 200,
        prUrl: 'https://github.com/org/repo/pull/200',
        body: 'This change. Closes #50',
      });

      expect(result?.bountyId).toBe(created.bountyId);
      expect(result?.prNumber).toBe(200);
      expect(result?.status).toBe('in_progress');
    });
  });

  // ── Bounty approval ───────────────────────────────────────────────────────

  describe('approveBounty', () => {
    it('closes the bounty and records a close_issue sync action', () => {
      const created = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 60,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/60',
      });

      const approved = service.approveBounty(created.bountyId);
      expect(approved.status).toBe('closed');

      const actions = service.getSyncActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        action: 'close_issue',
        repoFullName: 'org/repo',
        issueNumber: 60,
      });
    });
  });

  // ── Sync timing / data consistency ───────────────────────────────────────

  describe('sync timing and data consistency', () => {
    it('bumps lastSyncedAt and updatedAt on every webhook sync', async () => {
      const created = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 70,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/70',
      });
      const firstSync = created.lastSyncedAt;

      await new Promise(resolve => setTimeout(resolve, 5));

      const result = service.handleWebhookEvent({
        event: 'issues',
        action: 'closed',
        repoFullName: 'org/repo',
        issueNumber: 70,
      });

      expect(result!.lastSyncedAt.getTime()).toBeGreaterThan(firstSync.getTime());
      expect(result!.updatedAt.getTime()).toEqual(result!.lastSyncedAt.getTime());
    });

    it('keeps the same bountyId consistent across create, link, and webhook sync', () => {
      const created = service.createFromIssue({
        repoFullName: 'org/repo',
        issueNumber: 80,
        issueTitle: 'T',
        issueBody: 'D',
        issueUrl: 'https://github.com/org/repo/issues/80',
      });
      const linked = service.linkPullRequest({
        bountyId: created.bountyId,
        prUrl: 'u',
        prNumber: 300,
      });
      const synced = service.handleWebhookEvent({
        event: 'pull_request',
        action: 'closed',
        repoFullName: 'org/repo',
        prNumber: 300,
        merged: true,
      });

      expect(linked.bountyId).toBe(created.bountyId);
      expect(synced!.bountyId).toBe(created.bountyId);
      expect(service.getBounty(created.bountyId).status).toBe('review');
    });
  });
});
