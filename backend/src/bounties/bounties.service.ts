import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  BountyStatus,
  CreateBountyDto,
  Difficulty,
  FeatureBountyDto,
  BountyListQueryDto,
  SortField,
} from './bounties.dto';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  acceptanceCriteria: string[];
  rewardUsd: number;
  difficulty: Difficulty;
  deadline: Date;
  bountyType: string;
  status: BountyStatus;
  reviewerAddress: string;
  reviewerGithub?: string;
  tags: string[];
  isInternal: boolean;
  featured: boolean;
  applicationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Max featured bounties shown in the marketplace
const MAX_FEATURED = 5;

// Trending window in milliseconds (7 days)
const TRENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Map difficulty to a numeric rank for sorting
const DIFFICULTY_RANK: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

@Injectable()
export class BountiesService {
  private readonly logger = new Logger(BountiesService.name);

  // In-memory store (replace with Prisma model in production)
  private bounties: Map<string, Bounty> = new Map();

  // Application tracking: bountyId -> list of { applicantId, appliedAt }
  private applications: Map<string, Array<{ applicantId: string; appliedAt: Date }>> = new Map();

  constructor() {
    // Seed some sample bounties for dev/demo
    this.seedSampleBounties();
  }

  // ── Public read (no auth required) ─────────────────────────────────────────

  /**
   * List all non-internal bounties with sorting, filtering, and pagination.
   * Target: <2s for 10,000+ bounties.
   */
  listPublic(query: BountyListQueryDto) {
    const {
      sort = 'reward',
      order = 'desc',
      difficulty,
      minReward,
      maxReward,
      tag,
      search,
      page = 1,
      limit = 20,
    } = query;

    let results = Array.from(this.bounties.values()).filter(
      b => !b.isInternal && b.status === 'open',
    );

    // Filter by difficulty
    if (difficulty) {
      results = results.filter(b => b.difficulty === difficulty);
    }

    // Filter by reward range
    if (minReward != null) {
      results = results.filter(b => b.rewardUsd >= minReward);
    }
    if (maxReward != null) {
      results = results.filter(b => b.rewardUsd <= maxReward);
    }

    // Filter by tag
    if (tag) {
      results = results.filter(b => b.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    }

    // Full-text search on title + description
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        b =>
          b.title.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q),
      );
    }

    // Sort
    results = this.sortBounties(results, sort, order);

    // Pagination
    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const data = results.slice(offset, offset + limit);

    return { data, total, page, totalPages, limit };
  }

  /**
   * Trending bounties: highest application count in last 7 days.
   */
  getTrending(limitN = 10) {
    const since = new Date(Date.now() - TRENDING_WINDOW_MS);

    const bountyApplicationCounts = Array.from(this.bounties.values())
      .filter(b => !b.isInternal && b.status === 'open')
      .map(b => {
        const apps = this.applications.get(b.id) ?? [];
        const recentCount = apps.filter(a => a.appliedAt >= since).length;
        return { bounty: b, recentCount };
      });

    return bountyApplicationCounts
      .sort((a, b) => b.recentCount - a.recentCount)
      .slice(0, limitN)
      .map(({ bounty, recentCount }) => ({ ...bounty, recentApplications: recentCount }));
  }

  /**
   * Recently added bounties.
   */
  getRecent(limitN = 10) {
    return Array.from(this.bounties.values())
      .filter(b => !b.isInternal && b.status === 'open')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limitN);
  }

  /**
   * Featured bounties (max 5, maintainer-curated).
   */
  getFeatured() {
    return Array.from(this.bounties.values())
      .filter(b => !b.isInternal && b.featured && b.status === 'open')
      .slice(0, MAX_FEATURED);
  }

  /**
   * Get full details for a single bounty (public — excludes internal).
   */
  getDetail(id: string): Bounty {
    const bounty = this.bounties.get(id);
    if (!bounty) throw new NotFoundException(`Bounty ${id} not found`);
    if (bounty.isInternal) throw new NotFoundException(`Bounty ${id} not found`);
    return bounty;
  }

  // ── Protected writes (auth required) ──────────────────────────────────────

  /**
   * Create a new bounty (maintainer only in production).
   */
  createBounty(dto: CreateBountyDto): Bounty {
    const id = `bounty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const bounty: Bounty = {
      id,
      title: dto.title,
      description: dto.description,
      requirements: dto.requirements,
      acceptanceCriteria: dto.acceptanceCriteria,
      rewardUsd: dto.rewardUsd,
      difficulty: dto.difficulty,
      deadline: new Date(dto.deadline),
      bountyType: dto.bountyType,
      status: 'open',
      reviewerAddress: dto.reviewerAddress,
      reviewerGithub: dto.reviewerGithub,
      tags: dto.tags ?? [],
      isInternal: dto.isInternal ?? false,
      featured: false,
      applicationCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.bounties.set(id, bounty);
    this.logger.log(`Bounty created: ${id} — "${dto.title}" ($${dto.rewardUsd})`);
    return bounty;
  }

  /**
   * Feature or unfeature a bounty (maintainer only).
   * Max 5 featured at a time.
   */
  setFeatured(dto: FeatureBountyDto): Bounty {
    const bounty = this.bounties.get(dto.bountyId);
    if (!bounty) throw new NotFoundException(`Bounty ${dto.bountyId} not found`);

    if (dto.featured) {
      const currentFeaturedCount = Array.from(this.bounties.values()).filter(b => b.featured).length;
      if (currentFeaturedCount >= MAX_FEATURED) {
        throw new BadRequestException(`Maximum of ${MAX_FEATURED} featured bounties already reached`);
      }
    }

    bounty.featured = dto.featured;
    bounty.updatedAt = new Date();
    this.bounties.set(dto.bountyId, bounty);
    return bounty;
  }

  /**
   * Record an application (increments counters for trending).
   * Application details are handled by a separate authenticated flow.
   */
  recordApplication(bountyId: string, applicantId: string): void {
    const bounty = this.bounties.get(bountyId);
    if (!bounty) throw new NotFoundException(`Bounty ${bountyId} not found`);

    const apps = this.applications.get(bountyId) ?? [];
    apps.push({ applicantId, appliedAt: new Date() });
    this.applications.set(bountyId, apps);

    bounty.applicationCount = apps.length;
    bounty.updatedAt = new Date();
    this.bounties.set(bountyId, bounty);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private sortBounties(items: Bounty[], sort: SortField, order: 'asc' | 'desc'): Bounty[] {
    const dir = order === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      switch (sort) {
        case 'reward':
          return dir * (a.rewardUsd - b.rewardUsd);
        case 'deadline':
          return dir * (a.deadline.getTime() - b.deadline.getTime());
        case 'difficulty':
          return dir * (DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);
        case 'applications':
          return dir * (a.applicationCount - b.applicationCount);
        default:
          return 0;
      }
    });
  }

  private seedSampleBounties() {
    const samples: CreateBountyDto[] = [
      {
        title: 'Implement Soroban Credit Minting Contract',
        description: 'Build the core Soroban smart contract for minting verified carbon credits with serial number generation and duplicate prevention.',
        requirements: ['Rust + Soroban SDK', 'On-chain serial registry', 'Unit tests'],
        acceptanceCriteria: ['>90% test coverage', '0 security issues', 'Deployed to testnet'],
        rewardUsd: 2500,
        difficulty: 'expert',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        bountyType: 'smart-contracts',
        reviewerAddress: 'GCARBONREVIEWERSTELLARADDRESS',
        reviewerGithub: 'carbon-reviewer',
        tags: ['soroban', 'rust', 'smart-contracts'],
        isInternal: false,
      },
      {
        title: 'Build Retirement Certificate PDF Generator',
        description: 'Create a downloadable PDF certificate for carbon credit retirements using jsPDF with QR codes and Stellar transaction links.',
        requirements: ['jsPDF integration', 'QR code embedding', 'Accessible PDF structure'],
        acceptanceCriteria: ['a11y score >85', 'Lighthouse >80', 'Mobile responsive'],
        rewardUsd: 800,
        difficulty: 'intermediate',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        bountyType: 'frontend',
        reviewerAddress: 'GCARBONREVIEWERSTELLARADDRESS',
        tags: ['frontend', 'next.js', 'pdf'],
        isInternal: false,
      },
      {
        title: 'Add Pagination to Marketplace API',
        description: 'The marketplace listings endpoint needs cursor-based pagination to support 10,000+ listings efficiently.',
        requirements: ['Cursor pagination', 'Prisma query optimisation', 'Response time <200ms'],
        acceptanceCriteria: ['80% backend coverage', 'All tests passing', 'Load test verified'],
        rewardUsd: 500,
        difficulty: 'beginner',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        bountyType: 'backend',
        reviewerAddress: 'GCARBONREVIEWERSTELLARADDRESS',
        tags: ['backend', 'nestjs', 'prisma'],
        isInternal: false,
      },
      {
        title: 'Docker Compose Production Deployment',
        description: 'Set up production-grade Docker Compose config with health checks, logging, and a comprehensive runbook.',
        requirements: ['Health checks', 'Log aggregation', 'Runbook in Markdown'],
        acceptanceCriteria: ['Runbook present', 'Deployment verified on staging'],
        rewardUsd: 600,
        difficulty: 'intermediate',
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        bountyType: 'devops',
        reviewerAddress: 'GCARBONREVIEWERSTELLARADDRESS',
        tags: ['devops', 'docker', 'deployment'],
        isInternal: false,
      },
      {
        title: 'Write API Documentation',
        description: 'Document all REST API endpoints with examples, error codes, and a getting-started guide.',
        requirements: ['OpenAPI spec', 'Code examples in 3 languages', 'Error reference table'],
        acceptanceCriteria: ['≥500 words per section', 'At least 1 example per endpoint'],
        rewardUsd: 350,
        difficulty: 'beginner',
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        bountyType: 'documentation',
        reviewerAddress: 'GCARBONREVIEWERSTELLARADDRESS',
        tags: ['docs', 'openapi'],
        isInternal: false,
      },
    ];

    samples.forEach(s => this.createBounty(s));
    // Feature the first two
    const ids = Array.from(this.bounties.keys()).slice(0, 2);
    ids.forEach(id => this.setFeatured({ bountyId: id, featured: true }));
  }
}
