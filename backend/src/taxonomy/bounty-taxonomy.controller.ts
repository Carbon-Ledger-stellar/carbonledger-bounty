import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BountyTaxonomyService } from './bounty-taxonomy.service';
import { CategorizeBountyDto, SearchTaxonomyQueryDto } from './bounty-taxonomy.dto';
import { Difficulty } from '../bounties/bounties.dto';
import { Domain, Impact } from './bounty-taxonomy';

@Controller('api/v1/taxonomy')
export class BountyTaxonomyController {
  constructor(private readonly taxonomyService: BountyTaxonomyService) {}

  /**
   * Full 4-level taxonomy tree (domain -> area -> component) plus the
   * domain-agnostic task-type classifier.
   */
  @Get()
  getTaxonomy() {
    return this.taxonomyService.getTaxonomyTree();
  }

  /**
   * Full-text search with independently-combinable facet filters.
   */
  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('domain') domain?: Domain,
    @Query('area') area?: string,
    @Query('component') component?: string,
    @Query('taskType') taskType?: string,
    @Query('difficulty') difficulty?: Difficulty,
    @Query('impact') impact?: Impact,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query: SearchTaxonomyQueryDto = {
      q,
      domain,
      area,
      component,
      taskType,
      difficulty,
      impact,
      tag,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    };
    return this.taxonomyService.search(query);
  }

  /**
   * Facet counts for the current filter set (each facet computed
   * independently of its own filter, so options never self-exclude).
   */
  @Get('facets')
  getFacets(
    @Query('q') q?: string,
    @Query('domain') domain?: Domain,
    @Query('area') area?: string,
    @Query('component') component?: string,
    @Query('taskType') taskType?: string,
    @Query('difficulty') difficulty?: Difficulty,
    @Query('impact') impact?: Impact,
    @Query('tag') tag?: string,
  ) {
    return this.taxonomyService.getFacetCounts({ q, domain, area, component, taskType, difficulty, impact, tag });
  }

  /**
   * Tag/term autocomplete suggestions for a given prefix.
   */
  @Get('autocomplete')
  autocomplete(@Query('prefix') prefix = '', @Query('limit') limit?: string) {
    return {
      suggestions: this.taxonomyService.autocomplete(prefix, limit ? Number(limit) : 10),
    };
  }

  /**
   * Preview the keyword-pattern auto-categorization for arbitrary
   * title/description text (used by the bounty creation form).
   */
  @Post('categorize')
  categorize(@Body() dto: CategorizeBountyDto) {
    return this.taxonomyService.categorize(dto.title, dto.description);
  }
}
