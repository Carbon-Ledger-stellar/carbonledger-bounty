import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  AddToPipelineDto,
  CompleteBountyDto,
  ContributorProfileDto,
  MovePipelineDto,
} from './portfolio.dto';
import { PortfolioService } from './portfolio.service';

@Controller('api/v1/portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  // ── Public read endpoints ──────────────────────────────────────────────────

  /**
   * Get dashboard summary stats for a contributor.
   * GET /api/v1/portfolio/:contributorId/dashboard
   */
  @Get(':contributorId/dashboard')
  getDashboard(@Param('contributorId') contributorId: string) {
    return this.portfolioService.getPortfolioDashboard(contributorId);
  }

  /**
   * Get kanban pipeline grouped by stage.
   * GET /api/v1/portfolio/:contributorId/pipeline
   */
  @Get(':contributorId/pipeline')
  getPipeline(@Param('contributorId') contributorId: string) {
    return this.portfolioService.getPipeline(contributorId);
  }

  /**
   * Get milestone timeline (past completions with earnings).
   * GET /api/v1/portfolio/:contributorId/milestones
   */
  @Get(':contributorId/milestones')
  getMilestones(@Param('contributorId') contributorId: string) {
    return this.portfolioService.getMilestones(contributorId);
  }

  /**
   * Get skills acquired in the last 90 days.
   * GET /api/v1/portfolio/:contributorId/skill-growth
   */
  @Get(':contributorId/skill-growth')
  getSkillGrowth(@Param('contributorId') contributorId: string) {
    return this.portfolioService.getSkillGrowth(contributorId);
  }

  /**
   * Get annual earnings projection based on historical trend.
   * GET /api/v1/portfolio/:contributorId/earnings-projection
   */
  @Get(':contributorId/earnings-projection')
  getEarningsProjection(@Param('contributorId') contributorId: string) {
    return this.portfolioService.getEarningsProjection(contributorId);
  }

  // ── Protected write endpoints ──────────────────────────────────────────────

  /**
   * Register a new contributor profile.
   * POST /api/v1/portfolio/register
   */
  @Post('register')
  @UseGuards(AuthGuard('jwt'))
  registerContributor(@Body() dto: ContributorProfileDto) {
    return this.portfolioService.registerContributor(dto);
  }

  /**
   * Add a bounty to the contributor's pipeline at a specific stage.
   * POST /api/v1/portfolio/:contributorId/pipeline/add
   */
  @Post(':contributorId/pipeline/add')
  @UseGuards(AuthGuard('jwt'))
  addToPipeline(
    @Param('contributorId') contributorId: string,
    @Body() dto: AddToPipelineDto,
  ) {
    return this.portfolioService.addToPipeline(contributorId, dto.bountyId, dto.stage);
  }

  /**
   * Move a bounty to a new stage in the pipeline.
   * POST /api/v1/portfolio/:contributorId/pipeline/move
   */
  @Post(':contributorId/pipeline/move')
  @UseGuards(AuthGuard('jwt'))
  movePipeline(
    @Param('contributorId') contributorId: string,
    @Body() dto: MovePipelineDto,
  ) {
    return this.portfolioService.movePipeline(contributorId, dto.bountyId, dto.newStage);
  }

  /**
   * Mark a bounty as complete and record earnings & skills.
   * POST /api/v1/portfolio/:contributorId/complete
   */
  @Post(':contributorId/complete')
  @UseGuards(AuthGuard('jwt'))
  completeBounty(
    @Param('contributorId') contributorId: string,
    @Body() dto: CompleteBountyDto,
  ) {
    return this.portfolioService.completeBounty(
      contributorId,
      dto.bountyId,
      dto.earningsUsd,
      dto.skills,
    );
  }
}
