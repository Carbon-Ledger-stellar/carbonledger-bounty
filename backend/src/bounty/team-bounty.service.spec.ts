import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TeamBountyService, ROLE_SHARE } from './team-bounty.service';

// Helper — sets up a bounty with a lead + one implementer ready for most tests
function setup(service: TeamBountyService) {
  const bounty = service.createTeamBounty('lead1', 'Fix Carbon Bug', 'Description', 1000, 3);
  service.addMember(bounty.id, 'lead1', 'impl1', 'implementer');
  return bounty.id;
}

describe('TeamBountyService', () => {
  let service: TeamBountyService;

  beforeEach(() => {
    service = new TeamBountyService();
  });

  // ── Creation ─────────────────────────────────────────────────────────────

  describe('createTeamBounty', () => {
    it('creates a bounty with the lead as first member', () => {
      const b = service.createTeamBounty('lead1', 'Title', 'Desc', 500, 2);
      expect(b.leadId).toBe('lead1');
      expect(b.members).toHaveLength(1);
      expect(b.members[0].role).toBe('lead');
      expect(b.members[0].approved).toBe(true);
    });

    it('rejects teamSize < 2', () => {
      expect(() =>
        service.createTeamBounty('lead1', 'T', 'D', 500, 1),
      ).toThrow(BadRequestException);
    });

    it('rejects teamSize > 5', () => {
      expect(() =>
        service.createTeamBounty('lead1', 'T', 'D', 500, 6),
      ).toThrow(BadRequestException);
    });

    it('rejects zero or negative reward', () => {
      expect(() =>
        service.createTeamBounty('lead1', 'T', 'D', 0, 2),
      ).toThrow(BadRequestException);
    });

    it('assigns status open and generates an id', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 200, 2);
      expect(b.status).toBe('open');
      expect(b.id).toBeDefined();
    });
  });

  // ── Member management ─────────────────────────────────────────────────────

  describe('addMember', () => {
    it('adds a member and transitions status to in_progress', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 500, 2);
      const updated = service.addMember(b.id, 'lead1', 'impl1', 'implementer');
      expect(updated.members).toHaveLength(2);
      expect(updated.status).toBe('in_progress');
    });

    it('throws ForbiddenException if caller is not lead', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 500, 3);
      expect(() =>
        service.addMember(b.id, 'notlead', 'impl1', 'implementer'),
      ).toThrow(ForbiddenException);
    });

    it('prevents adding a second lead', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 500, 3);
      expect(() =>
        service.addMember(b.id, 'lead1', 'other', 'lead'),
      ).toThrow(BadRequestException);
    });

    it('prevents adding a duplicate member', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 500, 3);
      service.addMember(b.id, 'lead1', 'impl1', 'implementer');
      expect(() =>
        service.addMember(b.id, 'lead1', 'impl1', 'implementer'),
      ).toThrow(BadRequestException);
    });

    it('caps reviewers at 2', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 500, 5);
      service.addMember(b.id, 'lead1', 'rev1', 'reviewer');
      service.addMember(b.id, 'lead1', 'rev2', 'reviewer');
      expect(() =>
        service.addMember(b.id, 'lead1', 'rev3', 'reviewer'),
      ).toThrow(BadRequestException);
    });

    it('prevents exceeding teamSize', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 500, 2);
      service.addMember(b.id, 'lead1', 'impl1', 'implementer');
      expect(() =>
        service.addMember(b.id, 'lead1', 'impl2', 'implementer'),
      ).toThrow(BadRequestException);
    });
  });

  // ── Contribution tracking ─────────────────────────────────────────────────

  describe('setContributions', () => {
    it('lead gets 40%, single implementer gets 60% (no reviewers)', () => {
      const id = setup(service);
      service.setContributions(id, 'lead1', { impl1: 1.0 });
      const b = service.getTeamBounty(id);
      const lead = b.members.find(m => m.role === 'lead')!;
      const impl = b.members.find(m => m.contributorId === 'impl1')!;
      expect(lead.contributionPct).toBeCloseTo(40);
      expect(impl.contributionPct).toBeCloseTo(60); // 100 - 40 = 60
    });

    it('two reviewers each get 20%', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 1000, 4);
      service.addMember(b.id, 'lead1', 'rev1', 'reviewer');
      service.addMember(b.id, 'lead1', 'rev2', 'reviewer');
      service.addMember(b.id, 'lead1', 'impl1', 'implementer');
      // lead=40%, rev1=20%, rev2=20%, impl pool=100-40-40=20%, impl1 gets all 20%
      service.setContributions(b.id, 'lead1', { impl1: 1.0 });
      const updated = service.getTeamBounty(b.id);
      const rev1 = updated.members.find(m => m.contributorId === 'rev1')!;
      const rev2 = updated.members.find(m => m.contributorId === 'rev2')!;
      expect(rev1.contributionPct).toBeCloseTo(20);
      expect(rev2.contributionPct).toBeCloseTo(20);
    });

    it('two implementers split the implementer pool by their fractions (no reviewers: pool=60%)', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 1000, 3);
      service.addMember(b.id, 'lead1', 'impl1', 'implementer');
      service.addMember(b.id, 'lead1', 'impl2', 'implementer');
      // lead=40%, no reviewers, impl pool=60%, split 60/40 → impl1=36%, impl2=24%
      service.setContributions(b.id, 'lead1', { impl1: 0.6, impl2: 0.4 });
      const updated = service.getTeamBounty(b.id);
      const i1 = updated.members.find(m => m.contributorId === 'impl1')!;
      const i2 = updated.members.find(m => m.contributorId === 'impl2')!;
      expect(i1.contributionPct).toBeCloseTo(36); // 0.6 × 60 = 36%
      expect(i2.contributionPct).toBeCloseTo(24); // 0.4 × 60 = 24%
    });

    it('rejects implementerShares that do not sum to 1', () => {
      const id = setup(service);
      expect(() =>
        service.setContributions(id, 'lead1', { impl1: 0.7 }),
      ).toThrow(BadRequestException);
    });

    it('rejects share assignment for non-implementer id', () => {
      const id = setup(service);
      expect(() =>
        service.setContributions(id, 'lead1', { impl1: 0.8, ghost: 0.2 }),
      ).toThrow(BadRequestException);
    });

    it('throws ForbiddenException if caller is not lead', () => {
      const id = setup(service);
      expect(() =>
        service.setContributions(id, 'notlead', { impl1: 1.0 }),
      ).toThrow(ForbiddenException);
    });
  });

  // ── Payment enforcement ───────────────────────────────────────────────────

  describe('enforcePayment', () => {
    it('scenario 1 — lead + 1 implementer: correct USD split (lead 40%, impl 60%)', () => {
      const id = setup(service);
      service.setContributions(id, 'lead1', { impl1: 1.0 });
      service.approveMember(id, 'lead1', 'impl1');
      const payouts = service.enforcePayment(id, 'lead1');

      // lead=40%, impl pool = 100-40 = 60% (no reviewers), impl1 gets all 60%
      const leadPayout = payouts.find(p => p.contributorId === 'lead1')!;
      const implPayout = payouts.find(p => p.contributorId === 'impl1')!;
      expect(leadPayout.shareUsd).toBeCloseTo(400);  // 40% of 1000
      expect(implPayout.shareUsd).toBeCloseTo(600);  // 60% of 1000
      const total = payouts.reduce((s, p) => s + p.shareUsd, 0);
      expect(total).toBeCloseTo(1000);
    });

    it('scenario 2 — lead + 2 reviewers + 1 implementer: correct USD split', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 1000, 4);
      service.addMember(b.id, 'lead1', 'rev1', 'reviewer');
      service.addMember(b.id, 'lead1', 'rev2', 'reviewer');
      service.addMember(b.id, 'lead1', 'impl1', 'implementer');
      // lead=40%, rev1=20%, rev2=20%, impl pool=100-40-40=20%, impl1 gets all 20%
      service.setContributions(b.id, 'lead1', { impl1: 1.0 });
      ['rev1', 'rev2', 'impl1'].forEach(id => service.approveMember(b.id, 'lead1', id));
      const payouts = service.enforcePayment(b.id, 'lead1');

      const total = payouts.reduce((s, p) => s + p.shareUsd, 0);
      expect(total).toBeCloseTo(1000);

      expect(payouts.find(p => p.contributorId === 'lead1')!.shareUsd).toBeCloseTo(400);
      expect(payouts.find(p => p.contributorId === 'rev1')!.shareUsd).toBeCloseTo(200);
      expect(payouts.find(p => p.contributorId === 'rev2')!.shareUsd).toBeCloseTo(200);
      expect(payouts.find(p => p.contributorId === 'impl1')!.shareUsd).toBeCloseTo(200);
    });

    it('scenario 3 — lead + 1 reviewer + 2 implementers (60/40 split): correct payouts', () => {
      const b = service.createTeamBounty('lead1', 'T', 'D', 1000, 4);
      service.addMember(b.id, 'lead1', 'rev1', 'reviewer');
      service.addMember(b.id, 'lead1', 'impl1', 'implementer');
      service.addMember(b.id, 'lead1', 'impl2', 'implementer');
      // lead=40%, rev1=20%, impl pool=100-40-20=40%, split 60/40
      // impl1=0.6×40=24%, impl2=0.4×40=16%  → total=100% ✓
      service.setContributions(b.id, 'lead1', { impl1: 0.6, impl2: 0.4 });
      ['rev1', 'impl1', 'impl2'].forEach(id => service.approveMember(b.id, 'lead1', id));
      const payouts = service.enforcePayment(b.id, 'lead1');

      const total = payouts.reduce((s, p) => s + p.shareUsd, 0);
      expect(total).toBeCloseTo(1000);

      expect(payouts.find(p => p.contributorId === 'lead1')!.shareUsd).toBeCloseTo(400);
      expect(payouts.find(p => p.contributorId === 'rev1')!.shareUsd).toBeCloseTo(200);
      expect(payouts.find(p => p.contributorId === 'impl1')!.shareUsd).toBeCloseTo(240);
      expect(payouts.find(p => p.contributorId === 'impl2')!.shareUsd).toBeCloseTo(160);
    });

    it('scenario 4 — rejects payment if a member is not approved', () => {
      const id = setup(service);
      service.setContributions(id, 'lead1', { impl1: 1.0 });
      // impl1 not approved
      expect(() => service.enforcePayment(id, 'lead1')).toThrow(BadRequestException);
    });

    it('scenario 5 — rejects payment with unresolved disputes', () => {
      const id = setup(service);
      service.setContributions(id, 'lead1', { impl1: 1.0 });
      service.approveMember(id, 'lead1', 'impl1');
      service.raiseDispute(id, 'lead1', 'impl1', 30, 'Disagreement');
      expect(() => service.enforcePayment(id, 'lead1')).toThrow(BadRequestException);
    });

    it('sets bounty status to paid after successful payment', () => {
      const id = setup(service);
      service.setContributions(id, 'lead1', { impl1: 1.0 });
      service.approveMember(id, 'lead1', 'impl1');
      service.enforcePayment(id, 'lead1');
      expect(service.getTeamBounty(id).status).toBe('paid');
    });
  });

  // ── Dispute resolution ────────────────────────────────────────────────────

  describe('dispute handling', () => {
    it('raises a dispute and sets status to disputed', () => {
      const id = setup(service);
      service.raiseDispute(id, 'lead1', 'impl1', 25, 'Did not deliver');
      expect(service.getTeamBounty(id).status).toBe('disputed');
      expect(service.getTeamBounty(id).disputes).toHaveLength(1);
    });

    it('resolves a dispute and updates contribution pct', () => {
      const id = setup(service);
      service.raiseDispute(id, 'lead1', 'impl1', 25, 'Less work');
      const disputeId = service.getTeamBounty(id).disputes[0].id;
      service.resolveDispute(id, 'lead1', disputeId);
      const impl1 = service.getTeamBounty(id).members.find(
        m => m.contributorId === 'impl1',
      )!;
      expect(impl1.contributionPct).toBe(25);
      expect(service.getTeamBounty(id).status).toBe('in_progress');
    });

    it('prevents resolving already-resolved dispute', () => {
      const id = setup(service);
      service.raiseDispute(id, 'lead1', 'impl1', 25, 'Reason');
      const disputeId = service.getTeamBounty(id).disputes[0].id;
      service.resolveDispute(id, 'lead1', disputeId);
      expect(() =>
        service.resolveDispute(id, 'lead1', disputeId),
      ).toThrow(BadRequestException);
    });

    it('only lead can raise a dispute', () => {
      const id = setup(service);
      expect(() =>
        service.raiseDispute(id, 'impl1', 'impl1', 30, 'Not a lead'),
      ).toThrow(ForbiddenException);
    });
  });
});
