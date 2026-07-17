import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BountiesService } from './bounties.service';
import { CreateBountyDto, FeatureBountyDto, BountyListQueryDto, SortField, Difficulty } from './bounties.dto';

@Controller('api/v1/bounties')
export class BountiesController {
  constructor(private bountiesService: BountiesService) {}

  // ── Public endpoints (no auth) ─────────────────────────────────────────────

  /**
   * Browse all public bounties with sorting, filtering, and pagination.
   */
  @Get()
  async listPublic(
    @Query('sort') sort?: SortField,
    @Query('order') order?: 'asc' | 'desc',
    @Query('difficulty') difficulty?: Difficulty,
    @Query('minReward') minReward?: string,
    @Query('maxReward') maxReward?: string,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query: BountyListQueryDto = {
      sort,
      order,
      difficulty,
      minReward: minReward ? Number(minReward) : undefined,
      maxReward: maxReward ? Number(maxReward) : undefined,
      tag,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    };
    return this.bountiesService.listPublic(query);
  }

  /**
   * Trending bounties: highest application count in last 7 days.
   */
  @Get('trending')
  async getTrending(@Query('limit') limit?: string) {
    return this.bountiesService.getTrending(limit ? Number(limit) : 10);
  }

  /**
   * Recently added bounties.
   */
  @Get('recent')
  async getRecent(@Query('limit') limit?: string) {
    return this.bountiesService.getRecent(limit ? Number(limit) : 10);
  }

  /**
   * Maintainer-featured bounties (max 5).
   */
  @Get('featured')
  async getFeatured() {
    return this.bountiesService.getFeatured();
  }

  /**
   * Full detail page for a single bounty.
   */
  @Get(':id')
  async getDetail(@Param('id') id: string) {
    return this.bountiesService.getDetail(id);
  }

  // ── Protected endpoints (auth required) ────────────────────────────────────

  /**
   * Create a new bounty (maintainer/admin only).
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createBounty(@Body() dto: CreateBountyDto) {
    return this.bountiesService.createBounty(dto);
  }

  /**
   * Feature or unfeature a bounty (maintainer only).
   */
  @Post('feature')
  @UseGuards(AuthGuard('jwt'))
  async setFeatured(@Body() dto: FeatureBountyDto) {
    return this.bountiesService.setFeatured(dto);
  }

  /**
   * Record a bounty application (authenticated contributors only).
   * Full application logic handled separately.
   */
  @Post(':id/apply')
  @UseGuards(AuthGuard('jwt'))
  async apply(@Param('id') bountyId: string, @Body('applicantId') applicantId: string) {
    this.bountiesService.recordApplication(bountyId, applicantId);
    return { success: true, bountyId };
  }
}
