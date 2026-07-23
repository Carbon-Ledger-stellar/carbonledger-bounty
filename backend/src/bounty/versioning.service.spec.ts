import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BountyVersioningService } from './versioning.service';

describe('BountyVersioningService', () => {
  let service: BountyVersioningService;

  beforeEach(() => {
    service = new BountyVersioningService();
  });

  // ── Initial version ──────────────────────────────────────────────────────

  describe('createInitialVersion', () => {
    it('creates v1 with status open and the given budget', () => {
      const v = service.createInitialVersion('bounty-1', { budgetUsd: 1000 }, 'maintainer1');
      expect(v.versionNumber).toBe(1);
      expect(v.status).toBe('open');
      expect(v.budgetUsd).toBe(1000);
      expect(v.milestoneIds).toEqual([]);
      expect(v.reopenReason).toBeUndefined();
    });

    it('rejects creating a second initial version for the same bounty', () => {
      service.createInitialVersion('bounty-1', { budgetUsd: 1000 }, 'maintainer1');
      expect(() =>
        service.createInitialVersion('bounty-1', { budgetUsd: 500 }, 'maintainer1'),
      ).toThrow(BadRequestException);
    });

    it('records a version_created audit entry', () => {
      service.createInitialVersion('bounty-1', { budgetUsd: 1000 }, 'maintainer1');
      const audit = service.getAuditTrail('bounty-1');
      expect(audit).toHaveLength(1);
      expect(audit[0].action).toBe('version_created');
      expect(audit[0].actorId).toBe('maintainer1');
    });
  });

  // ── Re-opening ───────────────────────────────────────────────────────────

  describe('reopenBounty', () => {
    function setupClosedBounty(): string {
      const bountyId = 'bounty-2';
      service.createInitialVersion(bountyId, { budgetUsd: 1000 }, 'maintainer1');
      service.updateVersionStatus(bountyId, { status: 'closed' }, 'maintainer1');
      return bountyId;
    }

    it('rejects re-opening when there is no version history', () => {
      expect(() =>
        service.reopenBounty('unknown-bounty', { reason: 'bug-fixes', budgetUsd: 200 }, 'm1'),
      ).toThrow(NotFoundException);
    });

    it('rejects re-opening a bounty whose current version is not closed', () => {
      service.createInitialVersion('bounty-3', { budgetUsd: 1000 }, 'maintainer1');
      expect(() =>
        service.reopenBounty('bounty-3', { reason: 'bug-fixes', budgetUsd: 200 }, 'maintainer1'),
      ).toThrow(BadRequestException);
    });

    it('creates an incrementing version with the re-open reason and budget', () => {
      const bountyId = setupClosedBounty();
      const v2 = service.reopenBounty(
        bountyId,
        { reason: 'additional-scope', budgetUsd: 300 },
        'maintainer2',
      );

      expect(v2.versionNumber).toBe(2);
      expect(v2.status).toBe('open');
      expect(v2.budgetUsd).toBe(300);
      expect(v2.reopenReason).toBe('additional-scope');
      expect(v2.reopenedBy).toBe('maintainer2');
    });

    it('supports partial re-opening for specific milestones only', () => {
      const bountyId = setupClosedBounty();
      const v2 = service.reopenBounty(
        bountyId,
        { reason: 'bug-fixes', budgetUsd: 150, milestoneIds: ['m-2', 'm-3'] },
        'maintainer1',
      );
      expect(v2.milestoneIds).toEqual(['m-2', 'm-3']);
    });

    it('keeps each version budget separate across re-opens', () => {
      const bountyId = setupClosedBounty();
      service.reopenBounty(bountyId, { reason: 'bug-fixes', budgetUsd: 150 }, 'm1');
      service.updateVersionStatus(bountyId, { status: 'closed' }, 'm1');
      service.reopenBounty(bountyId, { reason: 'new-requirements', budgetUsd: 400 }, 'm1');

      const history = service.getVersionHistory(bountyId);
      expect(history.map(v => v.budgetUsd)).toEqual([1000, 150, 400]);
    });

    it('records a reopened audit entry with reason and actor', () => {
      const bountyId = setupClosedBounty();
      service.reopenBounty(
        bountyId,
        { reason: 'initial-rejected', budgetUsd: 100, notes: 'resubmission requested' },
        'maintainer9',
      );

      const audit = service.getAuditTrail(bountyId);
      const reopenEntry = audit.find(a => a.action === 'reopened');
      expect(reopenEntry?.actorId).toBe('maintainer9');
      expect(reopenEntry?.reason).toBe('initial-rejected');
      expect(reopenEntry?.notes).toBe('resubmission requested');
    });
  });

  // ── Status changes ───────────────────────────────────────────────────────

  describe('updateVersionStatus', () => {
    it('transitions the current version status and stamps closedAt when closed', () => {
      service.createInitialVersion('bounty-4', { budgetUsd: 500 }, 'm1');
      service.updateVersionStatus('bounty-4', { status: 'in_progress' }, 'm1');
      const closed = service.updateVersionStatus('bounty-4', { status: 'closed' }, 'm1');

      expect(closed.status).toBe('closed');
      expect(closed.closedAt).toBeInstanceOf(Date);
    });

    it('rejects further status changes once closed (must re-open instead)', () => {
      service.createInitialVersion('bounty-5', { budgetUsd: 500 }, 'm1');
      service.updateVersionStatus('bounty-5', { status: 'closed' }, 'm1');
      expect(() =>
        service.updateVersionStatus('bounty-5', { status: 'in_progress' }, 'm1'),
      ).toThrow(BadRequestException);
    });
  });

  // ── Queries ──────────────────────────────────────────────────────────────

  describe('getVersionHistory / getCurrentVersion', () => {
    it('shows all versions in order, and current returns the latest', () => {
      service.createInitialVersion('bounty-6', { budgetUsd: 500 }, 'm1');
      service.updateVersionStatus('bounty-6', { status: 'closed' }, 'm1');
      service.reopenBounty('bounty-6', { reason: 'bug-fixes', budgetUsd: 50 }, 'm1');

      const history = service.getVersionHistory('bounty-6');
      expect(history.map(v => v.versionNumber)).toEqual([1, 2]);
      expect(service.getCurrentVersion('bounty-6').versionNumber).toBe(2);
    });

    it('throws NotFoundException for a bounty with no history', () => {
      expect(() => service.getVersionHistory('nope')).toThrow(NotFoundException);
    });
  });
});
