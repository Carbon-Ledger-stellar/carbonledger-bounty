import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkillMatcherService } from './skill-matcher.service';
import { RegisterContributorDto } from './matching.dto';
import { SKILL_TAXONOMY, SKILL_LIST, SKILL_TO_CATEGORY } from './skill-taxonomy';

@Controller('api/v1/matching')
export class MatchingController {
  constructor(private readonly skillMatcherService: SkillMatcherService) {}

  // ── Public read endpoints ──────────────────────────────────────────────────

  /**
   * Return the full skill taxonomy (categories + skills).
   * GET /api/v1/matching/taxonomy
   */
  @Get('taxonomy')
  getTaxonomy() {
    return {
      categories: SKILL_TAXONOMY,
      allSkills: SKILL_LIST,
      skillToCategory: SKILL_TO_CATEGORY,
      totalSkills: SKILL_LIST.length,
    };
  }

  /**
   * List all registered contributor profiles.
   * GET /api/v1/matching/contributors
   */
  @Get('contributors')
  getAllContributors() {
    return this.skillMatcherService.getAllContributors();
  }

  /**
   * Get a specific contributor's profile.
   * GET /api/v1/matching/contributors/:contributorId
   */
  @Get('contributors/:contributorId')
  getContributor(@Param('contributorId') contributorId: string) {
    return this.skillMatcherService.getContributorProfile(contributorId);
  }

  /**
   * Get ranked bounty recommendations for a contributor.
   * GET /api/v1/matching/recommendations/:contributorId?limit=10
   */
  @Get('recommendations/:contributorId')
  getRecommendations(
    @Param('contributorId') contributorId: string,
    @Query('limit') limit?: string,
  ) {
    return this.skillMatcherService.getRecommendations(
      contributorId,
      limit ? Number(limit) : 10,
    );
  }

  /**
   * Get high-match bounties filtered by minimum score.
   * GET /api/v1/matching/recommendations/:contributorId/top?minScore=70
   */
  @Get('recommendations/:contributorId/top')
  getTopMatches(
    @Param('contributorId') contributorId: string,
    @Query('minScore') minScore?: string,
  ) {
    return this.skillMatcherService.getSuggestedBounties(
      contributorId,
      minScore ? Number(minScore) : 70,
    );
  }

  /**
   * Get learning path suggestions for skills the contributor is missing.
   * GET /api/v1/matching/learning-paths/:contributorId
   */
  @Get('learning-paths/:contributorId')
  getLearningPaths(@Param('contributorId') contributorId: string) {
    return this.skillMatcherService.getLearningPaths(contributorId);
  }

  // ── Protected write endpoints ──────────────────────────────────────────────

  /**
   * Register a new contributor profile with skills and experience.
   * POST /api/v1/matching/contributors
   */
  @Post('contributors')
  @UseGuards(AuthGuard('jwt'))
  registerContributor(@Body() dto: RegisterContributorDto) {
    const profile = {
      contributorId: dto.contributorId,
      skills: dto.skills,
      experienceLevel: dto.experienceLevel,
      pastCompletions: dto.pastCompletions,
      successRate: dto.successRate,
      preferredTypes: dto.preferredTypes ?? [],
    };
    return this.skillMatcherService.registerContributor(profile);
  }

  /**
   * Compute recommendations for multiple contributors at once.
   * POST /api/v1/matching/batch-recommendations
   */
  @Post('batch-recommendations')
  @UseGuards(AuthGuard('jwt'))
  batchRecommendations(@Body() body: { contributorIds: string[] }) {
    const resultsMap = this.skillMatcherService.getBatchRecommendations(
      body.contributorIds,
    );
    // Convert Map to plain object for JSON serialisation
    return Object.fromEntries(resultsMap.entries());
  }
}
