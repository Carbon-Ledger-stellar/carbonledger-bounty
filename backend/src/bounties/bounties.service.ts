import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  BountyStatus,
  CreateBountyDto,
  Difficulty,
  FeatureBountyDto,
  BountyListQueryDto,
  OverridePriceDto,
  SortField,
} from './bounties.dto';
import { DIFFICULTY_TO_TIER, PricingBreakdown, PricingService } from './pricing.service';
import { PrismaService } from '../prisma.service';
import { DependencyService } from './dependency.service';

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
  /** Admin price override in USD, if set (bounded to +/-30% of computed price). */
  priceOverride?: number;
  createdAt: Date;
  updatedAt: Date;
  /** Prerequisites that must be completed before this bounty can be claimed */
  prerequisites?: BountyDependency[];
  /** Bounties that depend on this one */
  dependents?: BountyDependency[];
  /** Whether this bounty is currently locked due to unmet prerequisites */
  isLocked?: boolean;
}

export interface BountyDependency {
  id: string;
  prerequisiteBountyId: string;
  dependentBountyId: string;
  isRequired: boolean;
  createdAt: Date;
  prerequisiteBounty?: Bounty;
  dependentBounty?: Bounty;
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

  constructor(
    private readonly pricing: PricingService,
    private readonly prisma: PrismaService,
    private readonly dependencyService: DependencyService,
  ) {
    // Seed some sample bounties for dev/demo
    this.seedSampleBounties();
  }

  // ── Public read (no auth required) ─────────────────────────────────────────

  /**
   * List all non-internal bounties with sorting, filtering, and pagination.
   * Target: <2s for 10,000+ bounties.
   */
  async listPublic(query: BountyListQueryDto) {
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

    // Build where conditions
    const where: any = {
      isInternal: false,
      status: 'open',
    };

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (minReward != null || maxReward != null) {
      where.rewardUsd = {};
      if (minReward != null) where.rewardUsd.gte = minReward;
      if (maxReward != null) where.rewardUsd.lte = maxReward;
    }

    if (tag) {
      where.tags = {
        contains: `"${tag}"`,
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build order by
    let orderBy: any = {};
    switch (sort) {
      case 'reward':
        orderBy.rewardUsd = order;
        break;
      case 'deadline':
        orderBy.deadline = order;
        break;
      case 'applications':
        orderBy.applicationCount = order;
        break;
      default:
        orderBy.createdAt = 'desc';
    }

    // Get total count and paginated results
    const [total, bounties] = await Promise.all([
      this.prisma.bounty.count({ where }),
      this.prisma.bounty.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          prerequisites: {
            include: {
              prerequisiteBounty: true,
            },
          },
          dependents: {
            include: {
              dependentBounty: true,
            },
          },
        },
      }),
    ]);

    // Add lock status to each bounty
    const bountiesWithLockStatus = await Promise.all(
      bounties.map(async (bounty) => ({
        ...this.transformBountyData(bounty),
        isLocked: await this.dependencyService.isBountyLocked(bounty.id),
      }))
    );

    const totalPages = Math.ceil(total / limit);

    return { 
      data: bountiesWithLockStatus, 
      total, 
      page, 
      totalPages, 
      limit 
    };
  }

  /**
   * Trending bounties: highest application count in last 7 days.
   */
  async getTrending(limitN = 10) {
    const since = new Date(Date.now() - TRENDING_WINDOW_MS);

    const bounties = await this.prisma.bounty.findMany({
      where: {
        isInternal: false,
        status: 'open',
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        applicationCount: 'desc',
      },
      take: limitN,
      include: {
        prerequisites: {
          include: {
            prerequisiteBounty: true,
          },
        },
        dependents: {
          include: {
            dependentBounty: true,
          },
        },
      },
    });

    // Add lock status
    return await Promise.all(
      bounties.map(async (bounty) => ({
        ...this.transformBountyData(bounty),
        isLocked: await this.dependencyService.isBountyLocked(bounty.id),
      }))
    );
  }

  /**
   * Recently added bounties.
   */
  async getRecent(limitN = 10) {
    const bounties = await this.prisma.bounty.findMany({
      where: {
        isInternal: false,
        status: 'open',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limitN,
      include: {
        prerequisites: {
          include: {
            prerequisiteBounty: true,
          },
        },
        dependents: {
          include: {
            dependentBounty: true,
          },
        },
      },
    });

    // Add lock status
    return await Promise.all(
      bounties.map(async (bounty) => ({
        ...this.transformBountyData(bounty),
        isLocked: await this.dependencyService.isBountyLocked(bounty.id),
      }))
    );
  }

  /**
   * Featured bounties (max 5, maintainer-curated).
   */
  async getFeatured() {
    const bounties = await this.prisma.bounty.findMany({
      where: {
        isInternal: false,
        featured: true,
        status: 'open',
      },
      take: MAX_FEATURED,
      include: {
        prerequisites: {
          include: {
            prerequisiteBounty: true,
          },
        },
        dependents: {
          include: {
            dependentBounty: true,
          },
        },
      },
    });

    // Add lock status
    return await Promise.all(
      bounties.map(async (bounty) => ({
        ...this.transformBountyData(bounty),
        isLocked: await this.dependencyService.isBountyLocked(bounty.id),
      }))
    );
  }

  /**
   * Get full details for a single bounty (public — excludes internal).
   */
  async getDetail(id: string) {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id },
      include: {
        prerequisites: {
          include: {
            prerequisiteBounty: true,
          },
        },
        dependents: {
          include: {
            dependentBounty: true,
          },
        },
      },
    });

    if (!bounty) throw new NotFoundException(`Bounty ${id} not found`);
    if (bounty.isInternal) throw new NotFoundException(`Bounty ${id} not found`);

    return {
      ...this.transformBountyData(bounty),
      isLocked: await this.dependencyService.isBountyLocked(bounty.id),
    };
  }

  // ── Protected writes (auth required) ──────────────────────────────────────

  /**
   * Create a new bounty (maintainer only in production).
   */
  async createBounty(dto: CreateBountyDto) {
    const tier = DIFFICULTY_TO_TIER[dto.difficulty];
    const basePrice = this.pricing.clampToTier(dto.rewardUsd, tier);

    const bounty = await this.prisma.bounty.create({
      data: {
        title: dto.title,
        description: dto.description,
        requirements: JSON.stringify(dto.requirements),
        acceptanceCriteria: JSON.stringify(dto.acceptanceCriteria),
        rewardUsd: basePrice,
        difficulty: dto.difficulty,
        deadline: new Date(dto.deadline),
        bountyType: dto.bountyType,
        status: 'open',
        reviewerAddress: dto.reviewerAddress,
        reviewerGithub: dto.reviewerGithub,
        tags: JSON.stringify(dto.tags ?? []),
        isInternal: dto.isInternal ?? false,
        featured: false,
        applicationCount: 0,
      },
      include: {
        prerequisites: {
          include: {
            prerequisiteBounty: true,
          },
        },
        dependents: {
          include: {
            dependentBounty: true,
          },
        },
      },
    });

    this.logger.log(`Bounty created: ${bounty.id} — "${dto.title}" ($${dto.rewardUsd})`);
    
    return {
      ...this.transformBountyData(bounty),
      isLocked: false, // New bounties start unlocked
    };
  }

  /**
   * Feature or unfeature a bounty (maintainer only).
   * Max 5 featured at a time.
   */
  async setFeatured(dto: FeatureBountyDto) {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id: dto.bountyId },
    });

    if (!bounty) throw new NotFoundException(`Bounty ${dto.bountyId} not found`);

    if (dto.featured) {
      const currentFeaturedCount = await this.prisma.bounty.count({
        where: { featured: true },
      });
      
      if (currentFeaturedCount >= MAX_FEATURED) {
        throw new BadRequestException(`Maximum of ${MAX_FEATURED} featured bounties already reached`);
      }
    }

    const updatedBounty = await this.prisma.bounty.update({
      where: { id: dto.bountyId },
      data: { featured: dto.featured },
      include: {
        prerequisites: {
          include: {
            prerequisiteBounty: true,
          },
        },
        dependents: {
          include: {
            dependentBounty: true,
          },
        },
      },
    });

    return {
      ...this.transformBountyData(updatedBounty),
      isLocked: await this.dependencyService.isBountyLocked(updatedBounty.id),
    };
  }

  /**
   * Record an application (increments counters for trending).
   * Application details are handled by a separate authenticated flow.
   */
  async recordApplication(bountyId: string, applicantId: string): Promise<void> {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id: bountyId },
    });

    if (!bounty) throw new NotFoundException(`Bounty ${bountyId} not found`);

    // Check if bounty is locked due to unmet prerequisites
    const isLocked = await this.dependencyService.isBountyLocked(bountyId);
    if (isLocked) {
      throw new BadRequestException('Cannot apply to this bounty: prerequisite bounties must be completed first');
    }

    await this.prisma.bounty.update({
      where: { id: bountyId },
      data: {
        applicationCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Complete a bounty and auto-unlock dependent bounties
   */
  async completeBounty(bountyId: string) {
    const bounty = await this.prisma.bounty.update({
      where: { id: bountyId },
      data: { status: 'closed' },
    });

    // Auto-unlock dependent bounties
    const unlockedBounties = await this.dependencyService.unlockDependentBounties(bountyId);
    
    this.logger.log(`Bounty ${bountyId} completed. Unlocked ${unlockedBounties.length} dependent bounties.`);
    
    return { bounty, unlockedBounties };
  }

  // ── Dynamic pricing ─────────────────────────────────────────────────────────

  /**
   * Current price breakdown for a bounty: base price, time decay, market
   * adjustment (qualified applicant pool), and any active admin override.
   */
  async getPricingBreakdown(id: string): Promise<PricingBreakdown> {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id },
    });

    if (!bounty) throw new NotFoundException(`Bounty ${id} not found`);

    return this.pricing.computePrice(
      {
        basePrice: bounty.rewardUsd,
        complexityTier: DIFFICULTY_TO_TIER[bounty.difficulty],
        postedAt: bounty.createdAt,
        qualifiedApplicantCount: bounty.applicationCount,
      },
      bounty.priceOverride,
    );
  }

  /**
   * Admin override of a bounty's price, bounded to +/-30% of the current
   * market-computed price. Throws if outside bounds.
   */
  async overridePrice(dto: OverridePriceDto): Promise<PricingBreakdown> {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id: dto.bountyId },
    });

    if (!bounty) throw new NotFoundException(`Bounty ${dto.bountyId} not found`);

    const { computedPrice } = this.pricing.computePrice({
      basePrice: bounty.rewardUsd,
      complexityTier: DIFFICULTY_TO_TIER[bounty.difficulty],
      postedAt: bounty.createdAt,
      qualifiedApplicantCount: bounty.applicationCount,
    });

    const validatedOverride = this.pricing.validateOverride(computedPrice, dto.price);

    await this.prisma.bounty.update({
      where: { id: dto.bountyId },
      data: { priceOverride: validatedOverride },
    });

    return this.getPricingBreakdown(dto.bountyId);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private transformBountyData(bounty: any) {
    return {
      ...bounty,
      requirements: JSON.parse(bounty.requirements || '[]'),
      acceptanceCriteria: JSON.parse(bounty.acceptanceCriteria || '[]'),
      tags: JSON.parse(bounty.tags || '[]'),
    };
  }

  private async seedSampleBounties() {
    // Check if bounties already exist
    const existingCount = await this.prisma.bounty.count();
    if (existingCount > 0) {
      this.logger.log('Bounties already exist, skipping seed');
      return;
    }

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

    const createdBounties = [];
    for (const sample of samples) {
      const bounty = await this.createBounty(sample);
      createdBounties.push(bounty);
    }

    // Feature the first two
    if (createdBounties.length >= 2) {
      await this.setFeatured({ bountyId: createdBounties[0].id, featured: true });
      await this.setFeatured({ bountyId: createdBounties[1].id, featured: true });
    }

    // Create some sample dependencies: 
    // 'Add Pagination' must be done before 'Docker Deployment'
    // 'API Documentation' must be done before 'Docker Deployment'
    if (createdBounties.length >= 4) {
      const paginationBounty = createdBounties.find(b => b.title.includes('Pagination'));
      const docsBounty = createdBounties.find(b => b.title.includes('API Documentation'));
      const dockerBounty = createdBounties.find(b => b.title.includes('Docker'));

      if (paginationBounty && dockerBounty) {
        await this.dependencyService.createDependency({
          prerequisiteBountyId: paginationBounty.id,
          dependentBountyId: dockerBounty.id,
          isRequired: true,
        });
      }

      if (docsBounty && dockerBounty) {
        await this.dependencyService.createDependency({
          prerequisiteBountyId: docsBounty.id,
          dependentBountyId: dockerBounty.id,
          isRequired: true,
        });
      }
    }

    this.logger.log(`Seeded ${createdBounties.length} sample bounties with dependencies`);
  }
