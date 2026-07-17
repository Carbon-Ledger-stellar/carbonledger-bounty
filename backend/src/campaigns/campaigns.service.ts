import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  AddBountiesCampaignDto,
  RemoveBountyFromCampaignDto,
  SetFeaturedBountiesDto,
  UpdateLeaderboardDto,
  CampaignResponse,
  LeaderboardResponse,
} from './campaigns.dto';

type CampaignStatus = 'pending' | 'active' | 'completed' | 'archived';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new campaign
   */
  async createCampaign(dto: CreateCampaignDto): Promise<CampaignResponse> {
    // Validate that endDate is after startDate
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const campaignId = `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const campaign = await this.prisma.campaign.create({
      data: {
        campaignId,
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate,
        endDate: dto.endDate,
        goal: dto.goal || 50,
        status: 'pending',
        featuredBounties: [],
      },
    });

    this.logger.log(`Campaign created: ${campaignId} — "${dto.name}"`);
    return this.mapCampaignToResponse(campaign);
  }

  /**
   * Get all campaigns with optional status filter
   */
  async getAllCampaigns(status?: CampaignStatus): Promise<CampaignResponse[]> {
    const campaigns = await this.prisma.campaign.findMany({
      where: status ? { status } : undefined,
      include: {
        bounties: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map(c => ({
      ...this.mapCampaignToResponse(c),
      bountyCount: c.bounties.length,
    }));
  }

  /**
   * Get a single campaign by ID
   */
  async getCampaignById(campaignId: string): Promise<CampaignResponse> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId },
      include: {
        bounties: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    return {
      ...this.mapCampaignToResponse(campaign),
      bountyCount: campaign.bounties.length,
    };
  }

  /**
   * Update a campaign
   */
  async updateCampaign(
    campaignId: string,
    dto: UpdateCampaignDto,
  ): Promise<CampaignResponse> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    // Validate that endDate is after startDate if both are provided
    if (dto.endDate && new Date(dto.endDate) <= new Date(campaign.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const updated = await this.prisma.campaign.update({
      where: { campaignId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
        ...(dto.endDate && { endDate: dto.endDate }),
        ...(dto.goal && { goal: dto.goal }),
      },
    });

    this.logger.log(`Campaign updated: ${campaignId}`);
    return this.mapCampaignToResponse(updated);
  }

  /**
   * Add bounties to a campaign
   */
  async addBountiesToCampaign(dto: AddBountiesCampaignDto): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId: dto.campaignId },
      include: { bounties: true },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${dto.campaignId} not found`);
    }

    // Check if adding these bounties would exceed the goal
    const totalBounties = campaign.bounties.length + dto.bountyIds.length;
    if (totalBounties > campaign.goal) {
      this.logger.warn(
        `Adding ${dto.bountyIds.length} bounties would exceed goal of ${campaign.goal}`,
      );
    }

    // Add bounties, handling duplicates gracefully
    for (const bountyId of dto.bountyIds) {
      try {
        await this.prisma.campaignBounty.create({
          data: {
            campaignId: dto.campaignId,
            bountyId,
          },
        });
      } catch (error: any) {
        // Skip if bounty already exists in campaign (unique constraint)
        if (error.code === 'P2002') {
          this.logger.warn(`Bounty ${bountyId} already in campaign ${dto.campaignId}`);
        } else {
          throw error;
        }
      }
    }

    this.logger.log(`Added ${dto.bountyIds.length} bounties to campaign ${dto.campaignId}`);
  }

  /**
   * Remove a bounty from a campaign
   */
  async removeBountyFromCampaign(dto: RemoveBountyFromCampaignDto): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${dto.campaignId} not found`);
    }

    const deleted = await this.prisma.campaignBounty.deleteMany({
      where: {
        campaignId: dto.campaignId,
        bountyId: dto.bountyId,
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundException(
        `Bounty ${dto.bountyId} not found in campaign ${dto.campaignId}`,
      );
    }

    // Remove from featured bounties if present
    const updatedFeatured = campaign.featuredBounties.filter(id => id !== dto.bountyId);
    if (updatedFeatured.length < campaign.featuredBounties.length) {
      await this.prisma.campaign.update({
        where: { campaignId: dto.campaignId },
        data: { featuredBounties: updatedFeatured },
      });
    }

    this.logger.log(`Removed bounty ${dto.bountyId} from campaign ${dto.campaignId}`);
  }

  /**
   * Set featured bounties for a campaign (max 5)
   */
  async setFeaturedBounties(dto: SetFeaturedBountiesDto): Promise<CampaignResponse> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId: dto.campaignId },
      include: { bounties: true },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${dto.campaignId} not found`);
    }

    if (dto.featuredBountyIds.length > 5) {
      throw new BadRequestException('Maximum 5 featured bounties allowed');
    }

    // Verify all featured bounties exist in the campaign
    const validBountyIds = new Set(campaign.bounties.map(b => b.bountyId));
    const invalidBounties = dto.featuredBountyIds.filter(id => !validBountyIds.has(id));

    if (invalidBounties.length > 0) {
      throw new BadRequestException(
        `Bounties not in campaign: ${invalidBounties.join(', ')}`,
      );
    }

    const updated = await this.prisma.campaign.update({
      where: { campaignId: dto.campaignId },
      data: { featuredBounties: dto.featuredBountyIds },
    });

    this.logger.log(`Featured bounties set for campaign ${dto.campaignId}`);
    return this.mapCampaignToResponse(updated);
  }

  /**
   * Get leaderboard for a campaign (top 10 contributors)
   */
  async getLeaderboard(campaignId: string, limit = 10): Promise<LeaderboardResponse[]> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const leaderboard = await this.prisma.leaderboardEntry.findMany({
      where: { campaignId },
      orderBy: [{ earnings: 'desc' }, { completions: 'desc' }],
      take: limit,
    });

    return leaderboard.map(entry => ({
      id: entry.id,
      contributorId: entry.contributorId,
      earnings: entry.earnings,
      completions: entry.completions,
      bonus: entry.bonus,
      rank: entry.rank,
    }));
  }

  /**
   * Update leaderboard entry (increments earnings/completions)
   */
  async updateLeaderboardEntry(dto: UpdateLeaderboardDto): Promise<LeaderboardResponse> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${dto.campaignId} not found`);
    }

    let entry = await this.prisma.leaderboardEntry.findUnique({
      where: {
        campaignId_contributorId: {
          campaignId: dto.campaignId,
          contributorId: dto.contributorId,
        },
      },
    });

    if (!entry) {
      // Create new leaderboard entry
      entry = await this.prisma.leaderboardEntry.create({
        data: {
          campaignId: dto.campaignId,
          contributorId: dto.contributorId,
          earnings: dto.earnings || 0,
          completions: dto.completions || 0,
          bonus: 0,
          rank: 0,
        },
      });
    } else {
      // Update existing entry
      entry = await this.prisma.leaderboardEntry.update({
        where: { id: entry.id },
        data: {
          ...(dto.earnings !== undefined && { earnings: dto.earnings }),
          ...(dto.completions !== undefined && { completions: dto.completions }),
        },
      });
    }

    this.logger.log(`Updated leaderboard entry for ${dto.contributorId} in campaign ${dto.campaignId}`);
    return this.mapLeaderboardToResponse(entry);
  }

  /**
   * Recalculate bonuses and ranks for top 3 contributors in a campaign
   * Top 3 get 15%, 10%, 5% bonus respectively
   */
  async recalculateBonuses(campaignId: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const leaderboard = await this.prisma.leaderboardEntry.findMany({
      where: { campaignId },
      orderBy: [{ earnings: 'desc' }, { completions: 'desc' }],
    });

    // Assign bonuses and ranks
    const bonusMap = [15, 10, 5]; // Top 3 bonuses

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const bonus = i < 3 ? bonusMap[i] : 0;
      const rank = i < 3 ? i + 1 : 0;

      await this.prisma.leaderboardEntry.update({
        where: { id: entry.id },
        data: { bonus, rank },
      });
    }

    this.logger.log(`Bonuses recalculated for campaign ${campaignId}`);
  }

  /**
   * Transition campaign status automatically based on dates
   * Runs on demand or via a scheduled job
   */
  async transitionCampaignStatus(campaignId: string): Promise<CampaignResponse> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const now = new Date();
    let newStatus = campaign.status;

    if (campaign.status === 'pending' && now >= campaign.startDate) {
      newStatus = 'active';
    } else if (campaign.status === 'active' && now >= campaign.endDate) {
      newStatus = 'completed';
      // Recalculate bonuses when campaign completes
      await this.recalculateBonuses(campaignId);
    } else if (campaign.status === 'completed') {
      newStatus = 'archived';
    }

    if (newStatus !== campaign.status) {
      const updated = await this.prisma.campaign.update({
        where: { campaignId },
        data: { status: newStatus },
      });

      this.logger.log(`Campaign ${campaignId} transitioned from ${campaign.status} to ${newStatus}`);
      return this.mapCampaignToResponse(updated);
    }

    return this.mapCampaignToResponse(campaign);
  }

  /**
   * Transition all campaigns that need status updates
   */
  async transitionAllCampaigns(): Promise<void> {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: { in: ['pending', 'active', 'completed'] },
      },
    });

    for (const campaign of campaigns) {
      await this.transitionCampaignStatus(campaign.campaignId);
    }

    this.logger.log(`Transitioned ${campaigns.length} campaigns`);
  }

  /**
   * Archive completed campaigns older than 30 days
   */
  async archiveOldCampaigns(daysOld = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await this.prisma.campaign.updateMany({
      where: {
        status: 'completed',
        endDate: { lt: cutoffDate },
      },
      data: { status: 'archived' },
    });

    this.logger.log(`Archived ${result.count} completed campaigns older than ${daysOld} days`);
    return result.count;
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { campaignId },
      include: {
        bounties: true,
        leaderboard: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    const totalEarnings = campaign.leaderboard.reduce((sum, entry) => sum + entry.earnings, 0);
    const totalCompletions = campaign.leaderboard.reduce((sum, entry) => sum + entry.completions, 0);

    return {
      campaignId,
      name: campaign.name,
      status: campaign.status,
      bountyCount: campaign.bounties.length,
      contributorCount: campaign.leaderboard.length,
      progress: `${campaign.bounties.length}/${campaign.goal}`,
      totalEarnings,
      totalCompletions,
      daysRemaining: Math.max(
        0,
        Math.ceil((campaign.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      ),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private mapCampaignToResponse(campaign: any): CampaignResponse {
    return {
      id: campaign.id,
      campaignId: campaign.campaignId,
      name: campaign.name,
      description: campaign.description,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      goal: campaign.goal,
      status: campaign.status,
      featuredBounties: campaign.featuredBounties,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private mapLeaderboardToResponse(entry: any): LeaderboardResponse {
    return {
      id: entry.id,
      contributorId: entry.contributorId,
      earnings: entry.earnings,
      completions: entry.completions,
      bonus: entry.bonus,
      rank: entry.rank,
    };
  }
}
