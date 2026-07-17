import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CampaignsService } from './campaigns.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  AddBountiesCampaignDto,
  RemoveBountyFromCampaignDto,
  SetFeaturedBountiesDto,
  UpdateLeaderboardDto,
} from './campaigns.dto';

@Controller('api/v1/campaigns')
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  // ── Public endpoints (no auth) ────────────────────────────────────────────

  /**
   * Get all campaigns with optional status filter
   * GET /api/v1/campaigns?status=active
   */
  @Get()
  async getAllCampaigns(@Query('status') status?: string) {
    const validStatuses = ['pending', 'active', 'completed', 'archived'];
    if (status && !validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }
    return this.campaignsService.getAllCampaigns(
      status as 'pending' | 'active' | 'completed' | 'archived' | undefined,
    );
  }

  /**
   * Get a single campaign by ID
   * GET /api/v1/campaigns/:campaignId
   */
  @Get(':campaignId')
  async getCampaignById(@Param('campaignId') campaignId: string) {
    return this.campaignsService.getCampaignById(campaignId);
  }

  /**
   * Get campaign statistics
   * GET /api/v1/campaigns/:campaignId/stats
   */
  @Get(':campaignId/stats')
  async getCampaignStats(@Param('campaignId') campaignId: string) {
    return this.campaignsService.getCampaignStats(campaignId);
  }

  /**
   * Get leaderboard for a campaign (top 10)
   * GET /api/v1/campaigns/:campaignId/leaderboard?limit=10
   */
  @Get(':campaignId/leaderboard')
  async getLeaderboard(
    @Param('campaignId') campaignId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? Number(limit) : 10;
    if (isNaN(limitNum) || limitNum < 1) {
      throw new BadRequestException('limit must be a positive number');
    }
    return this.campaignsService.getLeaderboard(campaignId, limitNum);
  }

  // ── Protected endpoints (auth required) ───────────────────────────────────

  /**
   * Create a new campaign (maintainer/admin only)
   * POST /api/v1/campaigns
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createCampaign(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.createCampaign(dto);
  }

  /**
   * Update a campaign (maintainer/admin only)
   * PUT /api/v1/campaigns/:campaignId
   */
  @Post(':campaignId/update')
  @UseGuards(AuthGuard('jwt'))
  async updateCampaign(
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaignsService.updateCampaign(campaignId, dto);
  }

  /**
   * Add bounties to a campaign (maintainer/admin only)
   * POST /api/v1/campaigns/:campaignId/bounties/add
   */
  @Post(':campaignId/bounties/add')
  @UseGuards(AuthGuard('jwt'))
  async addBountiesToCampaign(
    @Param('campaignId') campaignId: string,
    @Body('bountyIds') bountyIds: string[],
  ) {
    if (!Array.isArray(bountyIds) || bountyIds.length === 0) {
      throw new BadRequestException('bountyIds must be a non-empty array');
    }
    await this.campaignsService.addBountiesToCampaign({
      campaignId,
      bountyIds,
    });
    return { success: true, message: `Added ${bountyIds.length} bounties to campaign` };
  }

  /**
   * Remove a bounty from a campaign (maintainer/admin only)
   * POST /api/v1/campaigns/:campaignId/bounties/remove
   */
  @Post(':campaignId/bounties/remove')
  @UseGuards(AuthGuard('jwt'))
  async removeBountyFromCampaign(
    @Param('campaignId') campaignId: string,
    @Body('bountyId') bountyId: string,
  ) {
    if (!bountyId) {
      throw new BadRequestException('bountyId is required');
    }
    await this.campaignsService.removeBountyFromCampaign({
      campaignId,
      bountyId,
    });
    return { success: true, message: 'Bounty removed from campaign' };
  }

  /**
   * Set featured bounties for a campaign (maintainer/admin only, max 5)
   * POST /api/v1/campaigns/:campaignId/featured
   */
  @Post(':campaignId/featured')
  @UseGuards(AuthGuard('jwt'))
  async setFeaturedBounties(
    @Param('campaignId') campaignId: string,
    @Body('featuredBountyIds') featuredBountyIds: string[],
  ) {
    if (!Array.isArray(featuredBountyIds)) {
      throw new BadRequestException('featuredBountyIds must be an array');
    }
    if (featuredBountyIds.length > 5) {
      throw new BadRequestException('Maximum 5 featured bounties allowed');
    }
    return this.campaignsService.setFeaturedBounties({
      campaignId,
      featuredBountyIds,
    });
  }

  /**
   * Update leaderboard entry for a contributor in a campaign
   * POST /api/v1/campaigns/:campaignId/leaderboard/update
   */
  @Post(':campaignId/leaderboard/update')
  @UseGuards(AuthGuard('jwt'))
  async updateLeaderboardEntry(
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateLeaderboardDto,
  ) {
    return this.campaignsService.updateLeaderboardEntry({
      campaignId,
      ...dto,
    });
  }

  /**
   * Recalculate bonuses for a campaign (maintainer/admin only)
   * POST /api/v1/campaigns/:campaignId/recalculate-bonuses
   */
  @Post(':campaignId/recalculate-bonuses')
  @UseGuards(AuthGuard('jwt'))
  async recalculateBonuses(@Param('campaignId') campaignId: string) {
    await this.campaignsService.recalculateBonuses(campaignId);
    return { success: true, message: 'Bonuses recalculated' };
  }

  /**
   * Manually transition a campaign's status (maintainer/admin only)
   * POST /api/v1/campaigns/:campaignId/transition
   */
  @Post(':campaignId/transition')
  @UseGuards(AuthGuard('jwt'))
  async transitionCampaignStatus(@Param('campaignId') campaignId: string) {
    return this.campaignsService.transitionCampaignStatus(campaignId);
  }

  /**
   * Transition all campaigns that need status updates (maintainer/admin only)
   * POST /api/v1/campaigns/admin/transition-all
   */
  @Post('admin/transition-all')
  @UseGuards(AuthGuard('jwt'))
  async transitionAllCampaigns() {
    await this.campaignsService.transitionAllCampaigns();
    return { success: true, message: 'All campaigns transitioned' };
  }

  /**
   * Archive old campaigns (maintainer/admin only)
   * POST /api/v1/campaigns/admin/archive-old?daysOld=30
   */
  @Post('admin/archive-old')
  @UseGuards(AuthGuard('jwt'))
  async archiveOldCampaigns(@Query('daysOld') daysOld?: string) {
    const daysOldNum = daysOld ? Number(daysOld) : 30;
    if (isNaN(daysOldNum) || daysOldNum < 1) {
      throw new BadRequestException('daysOld must be a positive number');
    }
    const archivedCount = await this.campaignsService.archiveOldCampaigns(daysOldNum);
    return { success: true, archivedCount };
  }
}
