import { Test } from '@nestjs/testing';
import { BountiesModule } from '../bounties/bounties.module';
import { BountiesService } from '../bounties/bounties.service';
import { CreateBountyDto } from '../bounties/bounties.dto';
import { BountyTaxonomyService } from './bounty-taxonomy.service';

function makeBountyDto(overrides: Partial<CreateBountyDto> = {}): CreateBountyDto {
  return {
    title: 'Implement Soroban token minting contract',
    description: 'Build a Soroban smart contract in Rust for minting tokens with duplicate prevention.',
    requirements: ['Rust'],
    acceptanceCriteria: ['tests pass'],
    rewardUsd: 1500,
    difficulty: 'advanced',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    bountyType: 'smart-contracts',
    reviewerAddress: 'GADDRESS',
    tags: ['soroban', 'rust'],
    isInternal: false,
    ...overrides,
  };
}

describe('BountyTaxonomyService', () => {
  let bountiesService: BountiesService;
  let taxonomyService: BountyTaxonomyService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [BountiesModule],
      providers: [BountyTaxonomyService],
    }).compile();

    bountiesService = moduleRef.get(BountiesService);
    taxonomyService = moduleRef.get(BountyTaxonomyService);
  });

  describe('categorize', () => {
    it('classifies a smart-contract bounty across all 4 levels', () => {
      const result = taxonomyService.categorize(
        'Implement Soroban token minting contract',
        'Build a Soroban smart contract in Rust for minting tokens with duplicate prevention.',
        ['soroban', 'rust'],
      );
      expect(result.domain).toBe('smart-contracts');
      expect(result.area).toBe('contract-development');
      expect(result.component).toBe('token-contracts');
      expect(result.taskType).toBe('implementation');
      expect(result.confidence).toBe(1);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });

    it('classifies a frontend bug-fix bounty', () => {
      const result = taxonomyService.categorize(
        'Fix broken React chart component',
        'The dashboard chart component throws an error on load; needs a bug fix.',
      );
      expect(result.domain).toBe('frontend');
      expect(result.taskType).toBe('bug-fix');
    });

    it('classifies a devops CI/CD bounty', () => {
      const result = taxonomyService.categorize(
        'Add GitHub Actions pipeline',
        'Set up a CI pipeline with GitHub Actions for automated deployment.',
      );
      expect(result.domain).toBe('devops');
      expect(result.area).toBe('ci-cd');
    });

    it('falls back to "other" when no keywords match', () => {
      const result = taxonomyService.categorize('Untitled task', 'No recognizable terms here at all.');
      expect(result.domain).toBe('other');
      expect(result.area).toBeNull();
      expect(result.component).toBeNull();
    });
  });

  describe('real-time indexing', () => {
    it('indexes a newly created bounty immediately via bountyCreated$', () => {
      const created = bountiesService.createBounty(
        makeBountyDto({ title: 'Unique Soroban Widget XYZ123', tags: ['soroban', 'unique-xyz123'] }),
      );

      const results = taxonomyService.search({ q: 'xyz123' });
      expect(results.data.some(b => b.id === created.id)).toBe(true);
      expect(results.data.find(b => b.id === created.id)?.domain).toBe('smart-contracts');
    });
  });

  describe('search', () => {
    it('finds bounties by full-text query across title/description/tags', () => {
      const results = taxonomyService.search({ q: 'soroban' });
      expect(results.data.length).toBeGreaterThan(0);
      expect(results.tookMs).toBeGreaterThanOrEqual(0);
    });

    it('applies facet filters independently and combinatorially', () => {
      bountiesService.createBounty(
        makeBountyDto({ title: 'Cheap frontend fix', description: 'Fix a small CSS bug in React.', rewardUsd: 100, difficulty: 'beginner', tags: [] }),
      );
      bountiesService.createBounty(
        makeBountyDto({ title: 'Expensive contract work', description: 'Implement Soroban contract.', rewardUsd: 3000, difficulty: 'expert', tags: [] }),
      );

      const byDomain = taxonomyService.search({ domain: 'frontend' });
      expect(byDomain.data.every(b => b.domain === 'frontend')).toBe(true);

      const byImpact = taxonomyService.search({ impact: 'critical' });
      expect(byImpact.data.every(b => b.impact === 'critical')).toBe(true);

      const combined = taxonomyService.search({ domain: 'smart-contracts', impact: 'critical', difficulty: 'expert' });
      expect(combined.data.every(b => b.domain === 'smart-contracts' && b.impact === 'critical' && b.difficulty === 'expert')).toBe(true);
    });

    it('paginates results', () => {
      const page1 = taxonomyService.search({ page: 1, limit: 2 });
      expect(page1.data.length).toBeLessThanOrEqual(2);
      expect(page1.limit).toBe(2);
    });
  });

  describe('getFacetCounts', () => {
    it('returns counts per facet unaffected by that facet\'s own filter', () => {
      const counts = taxonomyService.getFacetCounts({ domain: 'smart-contracts' });
      expect(counts.domain).toBeDefined();
      expect(Object.keys(counts.domain).length).toBeGreaterThan(1);
    });
  });

  describe('autocomplete', () => {
    it('suggests tags matching a prefix, ranked by frequency', () => {
      const suggestions = taxonomyService.autocomplete('sor');
      expect(suggestions).toContain('soroban');
    });

    it('returns an empty array for an empty prefix', () => {
      expect(taxonomyService.autocomplete('')).toEqual([]);
    });

    it('respects the limit parameter', () => {
      const suggestions = taxonomyService.autocomplete('', 5);
      expect(suggestions.length).toBe(0);
      const prefixed = taxonomyService.autocomplete('s', 1);
      expect(prefixed.length).toBeLessThanOrEqual(1);
    });
  });
});
