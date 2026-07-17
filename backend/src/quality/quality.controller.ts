import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QualityGatesService } from './quality-gates.service';
import { SubmitMetricsDto, ReviewDecisionDto, BountyType } from './quality.dto';

@Controller('api/v1/quality')
export class QualityController {
  constructor(private qualityService: QualityGatesService) {}

  /**
   * Submit quality metrics for a bounty submission.
   * Runs gate checks and returns pass/fail + payment-blocked status.
   */
  @Post('submit')
  @UseGuards(AuthGuard('jwt'))
  async submitMetrics(@Body() dto: SubmitMetricsDto) {
    return this.qualityService.submitMetrics(dto);
  }

  /**
   * Reviewer approves or requests changes.
   */
  @Post('review')
  @UseGuards(AuthGuard('jwt'))
  async reviewSubmission(@Body() dto: ReviewDecisionDto) {
    return this.qualityService.reviewSubmission(dto);
  }

  /**
   * Get a specific quality check by ID.
   */
  @Get('checks/:id')
  @UseGuards(AuthGuard('jwt'))
  async getCheck(@Param('id') id: string) {
    return this.qualityService.getCheck(id);
  }

  /**
   * List quality checks, optionally filtered by bountyId / contributorId / status.
   */
  @Get('checks')
  @UseGuards(AuthGuard('jwt'))
  async listChecks(
    @Query('bountyId') bountyId?: string,
    @Query('contributorId') contributorId?: string,
    @Query('status') status?: string,
  ) {
    return this.qualityService.listChecks({ bountyId, contributorId, status });
  }

  /**
   * Quality trends dashboard — aggregated scores per bounty type.
   */
  @Get('trends')
  @UseGuards(AuthGuard('jwt'))
  async getTrends() {
    return this.qualityService.getTrends();
  }

  /**
   * Get gate definitions for a specific bounty type.
   */
  @Get('gates/:bountyType')
  async getGateDefinitions(@Param('bountyType') bountyType: string) {
    return this.qualityService.getGateDefinitions(bountyType as BountyType);
  }

  /**
   * List all supported bounty types and their gates.
   */
  @Get('types')
  async getSupportedTypes() {
    const types = this.qualityService.getSupportedTypes();
    return types.map(type => ({
      type,
      gates: this.qualityService.getGateDefinitions(type),
    }));
  }
}
