import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RoutingService, ContributorProfile, RoutingCriteria } from './routing.service';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Helper: build a contributor with sensible defaults
function makeContributor(overrides: Partial<ContributorProfile> = {}): ContributorProfile {
  return {
    id: `contrib-${Math.random().toString(36).substr(2, 6)}`,
    skillLevel: 'mid',
    skills: ['nestjs', 'typescript'],
    reputationScore: 75,
    available: true,
    activeBountyCount: 0,
    ...overrides,
  };
}

const defaultCriteria: RoutingCriteria = {
  difficulty: 'intermediate',
  requiredSkills: ['nestjs'],
  minReputation: 50,
};

describe('RoutingService', () => {
  let service: RoutingService;

  beforeEach(() => {
    service = new RoutingService();
  });

  // ── Contributor registry ─────────────────────────────────────────────────

  describe('upsertContributor / getContributor', () => {
    it('stores and retrieves a contributor', () => {
      const c = makeContributor({ id: 'alice' });
      service.upsertContributor(c);
      expect(service.getContributor('alice')).toEqual(c);
    });

    it('throws NotFoundException for unknown contributor', () => {
      expect(() => service.getContributor('unknown')).toThrow(NotFoundException);
    });

    it('overwrites an existing contributor on upsert', () => {
      const original = makeContributor({ id: 'alice', reputationScore: 60 });
      const updated = { ...original, reputationScore: 90 };
      service.upsertContributor(original);
      service.upsertContributor(updated);
      expect(service.getContributor('alice').reputationScore).toBe(90);
    });
  });

  // ── Routing consistency ──────────────────────────────────────────────────

  describe('routeBounty', () => {
    it('selects up to 5 most-qualified available contributors', () => {
      for (let i = 0; i < 8; i++) {
        service.upsertContributor(
          makeContributor({ id: `c${i}`, reputationScore: i * 10, skills: ['nestjs', 'typescript'] }),
        );
      }
      const state = service.routeBounty('b1', 500, defaultCriteria);
      expect(state.selectedContributorIds.length).toBeLessThanOrEqual(5);
      expect(state.status).toBe('routed');
    });

    it('routes deterministically — same contributors selected on repeated calls with identical data', () => {
      const profiles: ContributorProfile[] = [
        makeContributor({ id: 'a', reputationScore: 80, skills: ['nestjs'] }),
        makeContributor({ id: 'b', reputationScore: 70, skills: ['nestjs'] }),
        makeContributor({ id: 'c', reputationScore: 60, skills: ['nestjs'] }),
      ];
      profiles.forEach(p => service.upsertContributor(p));

      const s1 = service.routeBounty('b1', 500, defaultCriteria);

      // Second service instance with same data
      const service2 = new RoutingService();
      profiles.forEach(p => service2.upsertContributor(p));
      const s2 = service2.routeBounty('b1', 500, defaultCriteria);

      expect(s1.selectedContributorIds).toEqual(s2.selectedContributorIds);
    });

    it('throws BadRequestException if bounty already routed', () => {
      service.upsertContributor(makeContributor({ id: 'a', skills: ['nestjs'] }));
      service.routeBounty('b1', 500, defaultCriteria);
      expect(() => service.routeBounty('b1', 500, defaultCriteria)).toThrow(BadRequestException);
    });

    it('excludes unavailable contributors', () => {
      service.upsertContributor(makeContributor({ id: 'busy', available: false, skills: ['nestjs'] }));
      service.upsertContributor(makeContributor({ id: 'free', available: true, skills: ['nestjs'] }));
      const state = service.routeBounty('b1', 500, defaultCriteria);
      expect(state.selectedContributorIds).not.toContain('busy');
      expect(state.selectedContributorIds).toContain('free');
    });

    it('excludes contributors with activeBountyCount >= 3', () => {
      service.upsertContributor(makeContributor({ id: 'maxed', activeBountyCount: 3, skills: ['nestjs'] }));
      service.upsertContributor(makeContributor({ id: 'ok', activeBountyCount: 2, skills: ['nestjs'] }));
      const state = service.routeBounty('b1', 500, defaultCriteria);
      expect(state.selectedContributorIds).not.toContain('maxed');
      expect(state.selectedContributorIds).toContain('ok');
    });

    it('excludes contributors below minReputation', () => {
      service.upsertContributor(makeContributor({ id: 'low', reputationScore: 30, skills: ['nestjs'] }));
      service.upsertContributor(makeContributor({ id: 'high', reputationScore: 80, skills: ['nestjs'] }));
      const state = service.routeBounty('b1', 500, { ...defaultCriteria, minReputation: 50 });
      expect(state.selectedContributorIds).not.toContain('low');
      expect(state.selectedContributorIds).toContain('high');
    });

    it('sorts by reputation descending', () => {
      ['a', 'b', 'c'].forEach((id, i) =>
        service.upsertContributor(makeContributor({ id, reputationScore: (i + 1) * 20, skills: ['nestjs'] })),
      );
      const state = service.routeBounty('b1', 500, defaultCriteria);
      // 'c' has highest reputation (60), should be first
      expect(state.selectedContributorIds[0]).toBe('c');
    });

    it('records an audit entry on initial routing', () => {
      service.upsertContributor(makeContributor({ id: 'a', skills: ['nestjs'] }));
      service.routeBounty('b1', 500, defaultCriteria);
      const log = service.getAuditLog('b1');
      expect(log).toHaveLength(1);
      expect(log[0].action).toBe('initial_routing');
    });

    it('sets priceFloor to 50% of basePrice', () => {
      service.upsertContributor(makeContributor({ id: 'a', skills: ['nestjs'] }));
      const state = service.routeBounty('b1', 1000, defaultCriteria);
      expect(state.priceFloor).toBe(500);
    });
  });

  // ── Escalation timing ────────────────────────────────────────────────────

  describe('evaluateEscalation', () => {
    beforeEach(() => {
      service.upsertContributor(makeContributor({ id: 'a', skills: ['nestjs'] }));
    });

    it('does nothing before 48 hours', () => {
      const t0 = new Date('2026-01-01T00:00:00Z');
      service.routeBounty('b1', 1000, defaultCriteria, t0);
      const t1 = new Date(t0.getTime() + 47 * HOUR);
      const state = service.evaluateEscalation('b1', defaultCriteria, t1);
      expect(state.status).toBe('routed');
      expect(state.currentPrice).toBe(1000);
    });

    it('drops price by 10% after 48 hours with no application', () => {
      const t0 = new Date('2026-01-01T00:00:00Z');
      service.routeBounty('b1', 1000, defaultCriteria, t0);
      const t1 = new Date(t0.getTime() + 48 * HOUR + 1);
      const state = service.evaluateEscalation('b1', defaultCriteria, t1);
      expect(state.status).toBe('escalated');
      expect(state.currentPrice).toBeCloseTo(900, 5);
    });

    it('price floor: cannot drop below 50% of base price', () => {
      const t0 = new Date('2026-01-01T00:00:00Z');
      service.routeBounty('b1', 1000, defaultCriteria, t0);
      // Apply many escalations
      for (let i = 1; i <= 10; i++) {
        const t = new Date(t0.getTime() + (48 * HOUR + 1) * i);
        service.evaluateEscalation('b1', defaultCriteria, t);
        // Manually reset routedAt so each call triggers the 48h branch
        const s = service.getRoutingState('b1');
        (s as any).routedAt = t;
        (s as any).firstApplicationAt = undefined;
      }
      const state = service.getRoutingState('b1');
      expect(state.currentPrice).toBeGreaterThanOrEqual(state.priceFloor);
    });

    it('escalates to manual_review after 5 days with no application', () => {
      const t0 = new Date('2026-01-01T00:00:00Z');
      service.routeBounty('b1', 1000, defaultCriteria, t0);
      const t5d = new Date(t0.getTime() + 5 * DAY + 1);
      const state = service.evaluateEscalation('b1', defaultCriteria, t5d);
      expect(state.status).toBe('manual_review');
    });

    it('records audit entries for each escalation step', () => {
      const t0 = new Date('2026-01-01T00:00:00Z');
      service.routeBounty('b1', 1000, defaultCriteria, t0);
      service.evaluateEscalation('b1', defaultCriteria, new Date(t0.getTime() + 48 * HOUR + 1));
      service.evaluateEscalation('b1', defaultCriteria, new Date(t0.getTime() + 5 * DAY + 1));
      const log = service.getAuditLog('b1');
      const actions = log.map(e => e.action);
      expect(actions).toContain('escalation_price_drop');
      expect(actions).toContain('escalation_manual_review');
    });

    it('does NOT escalate if an application has already been received', () => {
      const t0 = new Date('2026-01-01T00:00:00Z');
      service.routeBounty('b1', 1000, defaultCriteria, t0);
      service.recordApplication('b1', 'a', new Date(t0.getTime() + HOUR));
      const t2d = new Date(t0.getTime() + 2 * DAY);
      const state = service.evaluateEscalation('b1', defaultCriteria, t2d);
      expect(state.status).toBe('routed');
      expect(state.currentPrice).toBe(1000);
    });

    it('does NOT re-escalate a bounty already in manual_review', () => {
      const t0 = new Date('2026-01-01T00:00:00Z');
      service.routeBounty('b1', 1000, defaultCriteria, t0);
      // First push to manual_review
      service.evaluateEscalation('b1', defaultCriteria, new Date(t0.getTime() + 5 * DAY + 1));
      const logBefore = service.getAuditLog('b1').length;
      // Call again — should be a no-op
      service.evaluateEscalation('b1', defaultCriteria, new Date(t0.getTime() + 6 * DAY));
      expect(service.getAuditLog('b1').length).toBe(logBefore);
    });
  });

  // ── Admin override ───────────────────────────────────────────────────────

  describe('adminOverride', () => {
    it('replaces selected contributors with the specified one', () => {
      service.upsertContributor(makeContributor({ id: 'original', skills: ['nestjs'] }));
      service.upsertContributor(makeContributor({ id: 'admin-pick', skills: [] }));
      service.routeBounty('b1', 500, defaultCriteria);
      const state = service.adminOverride('b1', 'admin-pick', defaultCriteria, 'VIP contributor');
      expect(state.selectedContributorIds).toEqual(['admin-pick']);
      expect(state.manualOverrideContributorId).toBe('admin-pick');
    });

    it('records an admin_override audit entry with the provided note', () => {
      service.upsertContributor(makeContributor({ id: 'a', skills: ['nestjs'] }));
      service.upsertContributor(makeContributor({ id: 'vip', skills: [] }));
      service.routeBounty('b1', 500, defaultCriteria);
      service.adminOverride('b1', 'vip', defaultCriteria, 'Special case');
      const log = service.getAuditLog('b1');
      const overrideEntry = log.find(e => e.action === 'admin_override');
      expect(overrideEntry).toBeDefined();
      expect(overrideEntry!.note).toBe('Special case');
    });

    it('throws NotFoundException for unknown contributor', () => {
      service.upsertContributor(makeContributor({ id: 'a', skills: ['nestjs'] }));
      service.routeBounty('b1', 500, defaultCriteria);
      expect(() => service.adminOverride('b1', 'ghost', defaultCriteria)).toThrow(NotFoundException);
    });
  });

  // ── Audit log ────────────────────────────────────────────────────────────

  describe('getAuditLog', () => {
    it('returns empty array for a bounty with no history', () => {
      service.upsertContributor(makeContributor({ id: 'a', skills: ['nestjs'] }));
      service.routeBounty('b1', 500, defaultCriteria);
      expect(service.getAuditLog('b99')).toEqual([]);
    });

    it('every audit entry has an id, timestamp, bountyId, and action', () => {
      service.upsertContributor(makeContributor({ id: 'a', skills: ['nestjs'] }));
      service.routeBounty('b1', 500, defaultCriteria);
      const log = service.getAuditLog('b1');
      log.forEach(entry => {
        expect(entry.id).toBeDefined();
        expect(entry.timestamp).toBeInstanceOf(Date);
        expect(entry.bountyId).toBe('b1');
        expect(entry.action).toBeDefined();
      });
    });
  });
});
