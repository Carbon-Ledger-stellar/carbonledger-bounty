import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { BountiesService } from '../bounties/bounties.service';
import {
  ContributorProfileDto,
  EarningsProjectionDto,
  MilestoneDto,
  PIPELINE_STAGES,
  PipelineStage,
  PortfolioSummaryDto,
  SkillGrowthDto,
} from './portfolio.dto';

export interface ContributorProfile {
  contributorId: string;
  skills: string[];
  walletAddress?: string;
  rating: number;
  createdAt: Date;
}

export interface PipelineItem {
  id: string;
  contributorId: string;
  bountyId: string;
  bountyTitle: string;
  rewardUsd: number;
  tags: string[];
  stage: PipelineStage;
  addedAt: Date;
  updatedAt: Date;
}

export interface Milestone {
  id: string;
  bountyId: string;
  bountyTitle: string;
  earningsUsd: number;
  completedAt: Date;
  skills: string[];
}

export interface SkillRecord {
  skill: string;
  acquiredAt: Date;
}

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  // In-memory stores
  private profiles: Map<string, ContributorProfile> = new Map();
  private pipeline: Map<string, PipelineItem[]> = new Map();
  private milestones: Map<string, Milestone[]> = new Map();
  private skillRecords: Map<string, SkillRecord[]> = new Map();

  constructor(private readonly bountiesService: BountiesService) {
    this.seedDemoData();
  }

  // ── Public read ────────────────────────────────────────────────────────────

  getPortfolioDashboard(contributorId: string): PortfolioSummaryDto {
    const profile = this.profiles.get(contributorId);
    if (!profile) {
      throw new NotFoundException(`Contributor ${contributorId} not found`);
    }

    const items = this.pipeline.get(contributorId) ?? [];
    const completed = this.milestones.get(contributorId) ?? [];

    const activeItems = items.filter(i => i.stage !== 'completed');
    const totalEarnings = completed.reduce((sum, m) => sum + m.earningsUsd, 0);

    const pipelineByStage: Record<PipelineStage, number> = {
      applied: 0,
      claimed: 0,
      'in-progress': 0,
      submitted: 0,
      'under-review': 0,
      completed: 0,
    };

    for (const item of items) {
      pipelineByStage[item.stage] = (pipelineByStage[item.stage] ?? 0) + 1;
    }
    pipelineByStage['completed'] = completed.length;

    return {
      contributorId,
      activeBounties: activeItems.length,
      completedBounties: completed.length,
      totalEarnings,
      rating: profile.rating,
      pipelineByStage,
    };
  }

  getPipeline(contributorId: string): Record<PipelineStage, PipelineItem[]> {
    this.ensureProfile(contributorId);
    const items = this.pipeline.get(contributorId) ?? [];

    const grouped: Record<PipelineStage, PipelineItem[]> = {
      applied: [],
      claimed: [],
      'in-progress': [],
      submitted: [],
      'under-review': [],
      completed: [],
    };

    for (const item of items) {
      grouped[item.stage].push(item);
    }

    return grouped;
  }

  getMilestones(contributorId: string): MilestoneDto[] {
    this.ensureProfile(contributorId);
    const records = this.milestones.get(contributorId) ?? [];
    return records
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
      .map(m => ({
        id: m.id,
        bountyId: m.bountyId,
        bountyTitle: m.bountyTitle,
        earningsUsd: m.earningsUsd,
        completedAt: m.completedAt.toISOString(),
        skills: m.skills,
      }));
  }

  getSkillGrowth(contributorId: string): SkillGrowthDto[] {
    this.ensureProfile(contributorId);
    const records = this.skillRecords.get(contributorId) ?? [];
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return records
      .filter(r => r.acquiredAt >= cutoff)
      .sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime())
      .map(r => ({ skill: r.skill, acquiredAt: r.acquiredAt.toISOString() }));
  }

  getEarningsProjection(contributorId: string): EarningsProjectionDto {
    this.ensureProfile(contributorId);
    const records = this.milestones.get(contributorId) ?? [];

    if (records.length === 0) {
      return {
        annualEstimate: 0,
        monthlyAverage: 0,
        basedOnMonths: 0,
        disclaimer: 'No completed bounties yet. Complete bounties to see your projection.',
      };
    }

    // Determine months spanned
    const oldest = records.reduce((min, m) => (m.completedAt < min ? m.completedAt : min), records[0].completedAt);
    const msPerMonth = 30 * 24 * 60 * 60 * 1000;
    const monthsSpanned = Math.max(1, Math.round((Date.now() - oldest.getTime()) / msPerMonth));

    const total = records.reduce((sum, m) => sum + m.earningsUsd, 0);
    const monthlyAverage = total / monthsSpanned;
    const annualEstimate = Math.round(monthlyAverage * 12);

    return {
      annualEstimate,
      monthlyAverage: Math.round(monthlyAverage),
      basedOnMonths: monthsSpanned,
      disclaimer:
        'Projection based on historical earnings trend. Actual results may vary.',
    };
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  registerContributor(dto: ContributorProfileDto): ContributorProfile {
    if (this.profiles.has(dto.contributorId)) {
      throw new BadRequestException(`Contributor ${dto.contributorId} already registered`);
    }
    const profile: ContributorProfile = {
      contributorId: dto.contributorId,
      skills: dto.skills,
      walletAddress: dto.walletAddress,
      rating: 0,
      createdAt: new Date(),
    };
    this.profiles.set(dto.contributorId, profile);
    this.logger.log(`Contributor registered: ${dto.contributorId}`);
    return profile;
  }

  addToPipeline(contributorId: string, bountyId: string, stage: PipelineStage): PipelineItem {
    this.ensureProfile(contributorId);

    const items = this.pipeline.get(contributorId) ?? [];
    const existing = items.find(i => i.bountyId === bountyId);
    if (existing) {
      throw new BadRequestException(`Bounty ${bountyId} already in pipeline`);
    }

    // Try to get bounty details; fall back to placeholder if not found
    let bountyTitle = `Bounty ${bountyId}`;
    let rewardUsd = 0;
    let tags: string[] = [];
    try {
      const bounty = this.bountiesService.getDetail(bountyId);
      bountyTitle = bounty.title;
      rewardUsd = bounty.rewardUsd;
      tags = bounty.tags;
    } catch {
      // bounty may not be in public store — allow pipeline entry
    }

    const item: PipelineItem = {
      id: `pi-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      contributorId,
      bountyId,
      bountyTitle,
      rewardUsd,
      tags,
      stage,
      addedAt: new Date(),
      updatedAt: new Date(),
    };

    items.push(item);
    this.pipeline.set(contributorId, items);
    return item;
  }

  movePipeline(contributorId: string, bountyId: string, newStage: PipelineStage): PipelineItem {
    this.ensureProfile(contributorId);
    const items = this.pipeline.get(contributorId) ?? [];
    const item = items.find(i => i.bountyId === bountyId);
    if (!item) {
      throw new NotFoundException(`Bounty ${bountyId} not in pipeline for ${contributorId}`);
    }
    item.stage = newStage;
    item.updatedAt = new Date();
    this.pipeline.set(contributorId, items);
    return item;
  }

  completeBounty(
    contributorId: string,
    bountyId: string,
    earningsUsd: number,
    skills: string[],
  ): Milestone {
    this.ensureProfile(contributorId);

    // Move pipeline item to completed
    const items = this.pipeline.get(contributorId) ?? [];
    const item = items.find(i => i.bountyId === bountyId);
    let bountyTitle = `Bounty ${bountyId}`;
    if (item) {
      item.stage = 'completed';
      item.updatedAt = new Date();
      bountyTitle = item.bountyTitle;
      this.pipeline.set(contributorId, items);
    }

    // Record milestone
    const milestone: Milestone = {
      id: `ms-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      bountyId,
      bountyTitle,
      earningsUsd,
      completedAt: new Date(),
      skills,
    };
    const existing = this.milestones.get(contributorId) ?? [];
    existing.push(milestone);
    this.milestones.set(contributorId, existing);

    // Record skills
    const skillRecs = this.skillRecords.get(contributorId) ?? [];
    for (const skill of skills) {
      skillRecs.push({ skill, acquiredAt: new Date() });
    }
    this.skillRecords.set(contributorId, skillRecs);

    this.logger.log(`Bounty completed: ${bountyId} by ${contributorId} (+$${earningsUsd})`);
    return milestone;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private ensureProfile(contributorId: string): void {
    if (!this.profiles.has(contributorId)) {
      throw new NotFoundException(`Contributor ${contributorId} not found`);
    }
  }

  /**
   * Seed demo data for contributor 'demo-contributor'.
   * - 3 active pipeline items
   * - 12 completed milestones over the past year (~$4,450 total)
   * - Skills acquired in last 90 days
   */
  private seedDemoData(): void {
    const id = 'demo-contributor';

    // Profile
    const profile: ContributorProfile = {
      contributorId: id,
      skills: ['Soroban', 'Rust', 'NestJS', 'TypeScript', 'React'],
      walletAddress: 'GDEMO000STELLARWALLETADDRESS000000000000000000000000000000',
      rating: 4.8,
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    };
    this.profiles.set(id, profile);

    // Active pipeline items (3 items, different stages)
    const activePipelineItems: PipelineItem[] = [
      {
        id: 'pi-demo-1',
        contributorId: id,
        bountyId: 'bounty-demo-active-1',
        bountyTitle: 'Implement Soroban Credit Minting Contract',
        rewardUsd: 2500,
        tags: ['soroban', 'rust', 'smart-contracts'],
        stage: 'in-progress',
        addedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'pi-demo-2',
        contributorId: id,
        bountyId: 'bounty-demo-active-2',
        bountyTitle: 'Build Retirement Certificate PDF Generator',
        rewardUsd: 800,
        tags: ['frontend', 'next.js', 'pdf'],
        stage: 'submitted',
        addedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'pi-demo-3',
        contributorId: id,
        bountyId: 'bounty-demo-active-3',
        bountyTitle: 'Add Pagination to Marketplace API',
        rewardUsd: 500,
        tags: ['backend', 'nestjs', 'prisma'],
        stage: 'under-review',
        addedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ];
    this.pipeline.set(id, activePipelineItems);

    // 12 completed milestones over the past year, earnings totalling ~$4,450
    const milestoneData: Array<{ title: string; earnings: number; daysAgo: number; skills: string[] }> = [
      { title: 'Setup CI/CD Pipeline', earnings: 300, daysAgo: 350, skills: ['GitHub Actions'] },
      { title: 'Write API Documentation', earnings: 350, daysAgo: 320, skills: ['OpenAPI', 'Markdown'] },
      { title: 'Docker Compose Production Config', earnings: 600, daysAgo: 290, skills: ['Docker', 'DevOps'] },
      { title: 'JWT Auth Middleware', earnings: 400, daysAgo: 250, skills: ['JWT', 'NestJS'] },
      { title: 'Prisma Schema Migrations', earnings: 300, daysAgo: 210, skills: ['Prisma', 'PostgreSQL'] },
      { title: 'Frontend Landing Page', earnings: 450, daysAgo: 180, skills: ['React', 'Next.js'] },
      { title: 'Oracle Price Feed Integration', earnings: 500, daysAgo: 150, skills: ['Soroban', 'TypeScript'] },
      { title: 'Fraud Detection Service', earnings: 400, daysAgo: 120, skills: ['NestJS', 'Algorithms'] },
      { title: 'Activity Feed WebSocket Gateway', earnings: 350, daysAgo: 80, skills: ['WebSocket', 'NestJS'] },
      { title: 'Bounty Pricing Engine', earnings: 300, daysAgo: 60, skills: ['Rust', 'NestJS'] },
      { title: 'Quality Gates Service', earnings: 200, daysAgo: 40, skills: ['NestJS', 'Testing'] },
      { title: 'Support Ticket System', earnings: 300, daysAgo: 15, skills: ['Soroban', 'Rust'] },
    ];

    const completedMilestones: Milestone[] = milestoneData.map((m, i) => ({
      id: `ms-demo-${i + 1}`,
      bountyId: `bounty-demo-completed-${i + 1}`,
      bountyTitle: m.title,
      earningsUsd: m.earnings,
      completedAt: new Date(Date.now() - m.daysAgo * 24 * 60 * 60 * 1000),
      skills: m.skills,
    }));
    this.milestones.set(id, completedMilestones);

    // Skills acquired in last 90 days (from recent milestones)
    const recentSkills: SkillRecord[] = [
      { skill: 'Soroban', acquiredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
      { skill: 'Rust', acquiredAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
      { skill: 'NestJS', acquiredAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      { skill: 'WebSocket', acquiredAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000) },
    ];
    this.skillRecords.set(id, recentSkills);

    this.logger.log('Demo portfolio data seeded for contributor: demo-contributor');
  }
}
