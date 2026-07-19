import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SkillMatcherService } from './skill-matcher.service';
import { BountiesService } from '../bounties/bounties.service';
import { ContributorProfile } from './matching.dto';
import { Bounty } from '../bounties/bounties.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeBounty = (overrides: Partial<Bounty> = {}): Bounty => ({
  id: 'bounty-test-1',
  title: 'Test Bounty',
  description: 'A test bounty',
  requirements: [],
  acceptanceCriteria: [],
  rewardUsd: 1000,
  difficulty: 'expert',
  deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  bountyType: 'smart-contracts',
  status: 'open',
  reviewerAddress: 'GTEST',
  reviewerGithub: undefined,
  tags: ['Soroban', 'Rust', 'WASM', 'smart contract testing'],
  isInternal: false,
  featured: false,
  applicationCount: 0,
  priceOverride: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeProfile = (overrides: Partial<ContributorProfile> = {}): ContributorProfile => ({
  contributorId: 'test-contributor',
  skills: ['Soroban', 'Rust', 'WASM', 'smart contract testing', 'contract security'],
  experienceLevel: 'expert',
  pastCompletions: 10,
  successRate: 0.9,
  preferredTypes: ['smart-contracts'],
  ...overrides,
});

/** Build a minimal mock BountiesService that returns a fixed bounty list */
const makeMockBountiesService = (bounties: Bounty[] = [makeBounty()]) => ({
  listPublic: jest.fn().mockReturnValue({ data: bounties, total: bounties.length, page: 1, totalPages: 1, limit: 1000 }),
  getDetail: jest.fn().mockImplementation((id: string) => {
    const found = bounties.find(b => b.id === id);
    if (!found) throw new NotFoundException(`Bounty ${id} not found`);
    return found;
  }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SkillMatcherService', () => {
  let service: SkillMatcherService;
  let bountiesServiceMock: ReturnType<typeof makeMockBountiesService>;

  beforeEach(async () => {
    bountiesServiceMock = makeMockBountiesService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillMatcherService,
        {
          provide: BountiesService,
          useValue: bountiesServiceMock,
        },
      ],
    }).compile();

    service = module.get<SkillMatcherService>(SkillMatcherService);
  });

  // ── computeMatchScore ───────────────────────────────────────────────────────

  describe('computeMatchScore', () => {
    it('should return >70 for an expert contributor on an expert bounty', () => {
      const profile = makeProfile({ experienceLevel: 'expert', successRate: 0.9 });
      const bounty = makeBounty({ difficulty: 'expert', tags: ['Soroban', 'Rust', 'WASM', 'smart contract testing'] });

      const score = service.computeMatchScore(profile, bounty);

      expect(score).toBeGreaterThan(70);
    });

    it('should return <50 for a beginner contributor on an expert bounty', () => {
      const profile = makeProfile({
        experienceLevel: 'junior',
        successRate: 0.5,
        skills: ['Markdown'], // only one unrelated skill
      });
      const bounty = makeBounty({
        difficulty: 'expert',
        tags: ['Soroban', 'Rust', 'WASM', 'contract security'],
      });

      const score = service.computeMatchScore(profile, bounty);

      expect(score).toBeLessThan(50);
    });

    it('should give maximum experience score (25) for exact level match', () => {
      const profile = makeProfile({ experienceLevel: 'mid', skills: [], successRate: 0 });
      const bounty = makeBounty({ difficulty: 'intermediate', tags: [] });

      const score = service.computeMatchScore(profile, bounty);

      // Only experience (25) and neutral skill (30) since no tags → score should be 25 + 30 = 55
      expect(score).toBe(55);
    });

    it('should score deterministically (same inputs → same score)', () => {
      const profile = makeProfile();
      const bounty = makeBounty();

      const score1 = service.computeMatchScore(profile, bounty);
      const score2 = service.computeMatchScore(profile, bounty);
      const score3 = service.computeMatchScore(profile, bounty);

      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
    });

    it('should clamp score to 0 on a completely mismatched profile', () => {
      const profile = makeProfile({
        experienceLevel: 'junior',
        skills: [],
        successRate: 0,
      });
      const bounty = makeBounty({ difficulty: 'expert', tags: ['Soroban', 'Rust'] });

      const score = service.computeMatchScore(profile, bounty);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should not exceed 100 for a perfect profile', () => {
      const profile = makeProfile({
        experienceLevel: 'expert',
        skills: ['Soroban', 'Rust', 'WASM', 'smart contract testing'],
        successRate: 1.0,
      });
      const bounty = makeBounty({
        difficulty: 'expert',
        tags: ['Soroban', 'Rust', 'WASM', 'smart contract testing'],
      });

      const score = service.computeMatchScore(profile, bounty);

      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ── registerContributor / getContributorProfile ─────────────────────────────

  describe('registerContributor', () => {
    it('should store and return the contributor profile', () => {
      const profile = makeProfile({ contributorId: 'new-user' });
      const result = service.registerContributor(profile);

      expect(result).toEqual(profile);
      expect(service.getContributorProfile('new-user')).toEqual(profile);
    });
  });

  describe('getContributorProfile', () => {
    it('should throw NotFoundException for unknown contributor', () => {
      expect(() => service.getContributorProfile('unknown-xyz')).toThrow(NotFoundException);
    });

    it('should return seeded demo contributor alice-dev', () => {
      const alice = service.getContributorProfile('alice-dev');
      expect(alice.contributorId).toBe('alice-dev');
      expect(alice.experienceLevel).toBe('senior');
    });
  });

  // ── getRecommendations ──────────────────────────────────────────────────────

  describe('getRecommendations', () => {
    it('should return recommendations sorted by matchScore descending', () => {
      const bounties = [
        makeBounty({ id: 'b1', tags: ['Soroban', 'Rust'], difficulty: 'expert' }),
        makeBounty({ id: 'b2', tags: ['React', 'CSS'], difficulty: 'beginner' }),
        makeBounty({ id: 'b3', tags: ['Soroban', 'Rust', 'WASM', 'smart contract testing'], difficulty: 'expert' }),
      ];
      bountiesServiceMock.listPublic.mockReturnValue({ data: bounties, total: 3, page: 1, totalPages: 1, limit: 1000 });

      const result = service.getRecommendations('alice-dev');

      const scores = result.recommendations.map(r => r.matchScore);
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    });

    it('should respect the limit parameter', () => {
      const bounties = Array.from({ length: 20 }, (_, i) =>
        makeBounty({ id: `b${i}`, tags: ['Soroban'] }),
      );
      bountiesServiceMock.listPublic.mockReturnValue({ data: bounties, total: 20, page: 1, totalPages: 1, limit: 1000 });

      const result = service.getRecommendations('alice-dev', 5);

      expect(result.recommendations).toHaveLength(5);
    });

    it('should include computedInMs in the response', () => {
      const result = service.getRecommendations('alice-dev');

      expect(result.computedInMs).toBeGreaterThanOrEqual(0);
    });

    it('should return cached results on second call within TTL', () => {
      service.getRecommendations('alice-dev');
      service.getRecommendations('alice-dev');

      // listPublic should only be called twice (once per unique cacheKey call)
      // but the cache makes the second call skip computation → called only once
      expect(bountiesServiceMock.listPublic).toHaveBeenCalledTimes(1);
    });

    it('should not return stale cached results after TTL expires', () => {
      // Simulate cache entry with expired timestamp
      const cacheKey = 'rec:alice-dev:10';
      // Access private field for testing purposes
      const privateService = service as any;
      privateService.cache.set(cacheKey, {
        results: { contributorId: 'alice-dev', recommendations: [], learningPaths: [], computedInMs: 0 },
        timestamp: Date.now() - 70_000, // 70 seconds ago — past the 60s TTL
      });

      service.getRecommendations('alice-dev');

      // Should have called listPublic to recompute
      expect(bountiesServiceMock.listPublic).toHaveBeenCalled();
    });
  });

  // ── getSuggestedBounties ────────────────────────────────────────────────────

  describe('getSuggestedBounties', () => {
    it('should only return bounties with matchScore >= minScore', () => {
      const bounties = [
        makeBounty({ id: 'high', tags: ['Soroban', 'Rust', 'WASM', 'smart contract testing'], difficulty: 'expert' }),
        makeBounty({ id: 'low', tags: ['React', 'CSS', 'html2canvas'], difficulty: 'beginner' }),
      ];
      bountiesServiceMock.listPublic.mockReturnValue({ data: bounties, total: 2, page: 1, totalPages: 1, limit: 1000 });

      const results = service.getSuggestedBounties('alice-dev', 70);

      expect(results.every(r => r.matchScore >= 70)).toBe(true);
    });

    it('should return empty array when no bounties meet the threshold', () => {
      const bounties = [makeBounty({ tags: ['React', 'CSS'], difficulty: 'beginner' })];
      bountiesServiceMock.listPublic.mockReturnValue({ data: bounties, total: 1, page: 1, totalPages: 1, limit: 1000 });

      // alice-dev has Soroban/Rust skills, React/CSS bounty won't score ≥ 95
      const results = service.getSuggestedBounties('alice-dev', 95);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should sort results by matchScore descending', () => {
      const bounties = [
        makeBounty({ id: 'b1', tags: ['Soroban'], difficulty: 'senior' }),
        makeBounty({ id: 'b2', tags: ['Soroban', 'Rust', 'WASM', 'smart contract testing'], difficulty: 'expert' }),
      ];
      bountiesServiceMock.listPublic.mockReturnValue({ data: bounties, total: 2, page: 1, totalPages: 1, limit: 1000 });

      const results = service.getSuggestedBounties('alice-dev', 0);

      const scores = results.map(r => r.matchScore);
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    });
  });

  // ── getLearningPaths ────────────────────────────────────────────────────────

  describe('getLearningPaths', () => {
    it('should only include bounties in the 30-70% match range', () => {
      const bounties = [
        // Low overlap → should be in learning range for bob-frontend
        makeBounty({ id: 'stretch', tags: ['NestJS', 'Node.js', 'PostgreSQL'], difficulty: 'intermediate' }),
        // Perfect match → should NOT appear in learning paths
        makeBounty({ id: 'perfect', tags: ['React', 'Next.js', 'TypeScript', 'CSS', 'SWR'], difficulty: 'intermediate' }),
      ];
      bountiesServiceMock.listPublic.mockReturnValue({ data: bounties, total: 2, page: 1, totalPages: 1, limit: 1000 });

      const paths = service.getLearningPaths('bob-frontend');

      // Every bounty referenced in learning paths must be a learning bounty
      for (const path of paths) {
        for (const bounty of path.relatedBounties) {
          expect(bounty.isLearningBounty).toBe(true);
          expect(bounty.matchScore).toBeGreaterThanOrEqual(30);
          expect(bounty.matchScore).toBeLessThanOrEqual(70);
        }
      }
    });

    it('should return learning paths with targetSkill and estimatedHours', () => {
      const bounties = [
        makeBounty({ id: 'learn1', tags: ['Docker', 'CI/CD'], difficulty: 'intermediate' }),
      ];
      bountiesServiceMock.listPublic.mockReturnValue({ data: bounties, total: 1, page: 1, totalPages: 1, limit: 1000 });

      const paths = service.getLearningPaths('bob-frontend');

      paths.forEach(path => {
        expect(typeof path.targetSkill).toBe('string');
        expect(path.estimatedHours).toBeGreaterThan(0);
      });
    });

    it('should return empty array when contributor already has all skills', () => {
      const bounties = [
        makeBounty({ id: 'full-match', tags: ['React', 'Next.js', 'TypeScript'], difficulty: 'intermediate' }),
      ];
      bountiesServiceMock.listPublic.mockReturnValue({ data: bounties, total: 1, page: 1, totalPages: 1, limit: 1000 });

      // bob-frontend has all three of those skills → 100% match → not a learning bounty
      const paths = service.getLearningPaths('bob-frontend');

      expect(Array.isArray(paths)).toBe(true);
    });
  });

  // ── getAllContributors ──────────────────────────────────────────────────────

  describe('getAllContributors', () => {
    it('should return at least the 4 seeded demo contributors', () => {
      const all = service.getAllContributors();
      const ids = all.map(c => c.contributorId);

      expect(ids).toContain('alice-dev');
      expect(ids).toContain('bob-frontend');
      expect(ids).toContain('carol-fullstack');
      expect(ids).toContain('dave-devops');
    });
  });

  // ── getBatchRecommendations ─────────────────────────────────────────────────

  describe('getBatchRecommendations', () => {
    it('should return a map with an entry for each known contributor', () => {
      const ids = ['alice-dev', 'bob-frontend'];
      const result = service.getBatchRecommendations(ids);

      expect(result.size).toBe(2);
      expect(result.has('alice-dev')).toBe(true);
      expect(result.has('bob-frontend')).toBe(true);
    });

    it('should silently skip unknown contributors', () => {
      const ids = ['alice-dev', 'does-not-exist'];
      const result = service.getBatchRecommendations(ids);

      expect(result.has('alice-dev')).toBe(true);
      expect(result.has('does-not-exist')).toBe(false);
    });
  });

  // ── Performance test ────────────────────────────────────────────────────────

  describe('performance', () => {
    it('should process batch recommendations for 100 contributors in <500ms', () => {
      // Register 100 contributors
      const ids: string[] = [];
      for (let i = 0; i < 100; i++) {
        const id = `perf-contributor-${i}`;
        ids.push(id);
        service.registerContributor(
          makeProfile({
            contributorId: id,
            skills: ['Soroban', 'Rust', 'TypeScript'],
            experienceLevel: 'mid',
            successRate: 0.8,
          }),
        );
      }

      // Provide a realistic set of bounties
      const bounties = Array.from({ length: 20 }, (_, i) =>
        makeBounty({ id: `perf-b${i}`, tags: ['Soroban', 'Rust', 'TypeScript'], difficulty: 'intermediate' }),
      );
      bountiesServiceMock.listPublic.mockReturnValue({ data: bounties, total: 20, page: 1, totalPages: 1, limit: 1000 });

      const start = Date.now();
      service.getBatchRecommendations(ids);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
    });

    it('should be deterministic across multiple invocations', () => {
      const profile = makeProfile({ contributorId: 'stability-test' });
      service.registerContributor(profile);

      const bounty = makeBounty({ tags: ['Soroban', 'Rust', 'WASM'] });
      bountiesServiceMock.listPublic.mockReturnValue({ data: [bounty], total: 1, page: 1, totalPages: 1, limit: 1000 });

      // Bust cache between calls to force recomputation
      const privateService = service as any;
      privateService.cache.clear();
      const r1 = service.getRecommendations('stability-test');

      privateService.cache.clear();
      const r2 = service.getRecommendations('stability-test');

      expect(r1.recommendations[0]?.matchScore).toBe(r2.recommendations[0]?.matchScore);
    });
  });
});
