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
import { BudgetService } from './budget.service';
import {
  BudgetCheckDto,
  BudgetDashboardQueryDto,
  BudgetOverrideDto,
  CreateBudgetDto,
} from './budget.dto';

/**
 * Budget API — quarterly project budget management.
 *
 * Routes:
 *   POST   /api/v1/budget                      — create / update a budget
 *   GET    /api/v1/budget/dashboard            — utilisation dashboard
 *   GET    /api/v1/budget/history/:projectId   — historical actuals
 *   GET    /api/v1/budget/:projectId/:period   — single budget lookup
 *   POST   /api/v1/budget/check                — pre-flight check for bounty creation
 *   POST   /api/v1/budget/override             — approve a budget override
 */
@Controller('api/v1/budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  // ── Admin / maintainer writes ───────────────────────────────────────────────

  /**
   * Create or update a quarterly budget for a project.
   * Requires JWT auth (maintainer / admin only).
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async upsertBudget(@Body() dto: CreateBudgetDto) {
    return this.budgetService.upsertBudget(dto);
  }

  /**
   * Approve a budget override (+20% max) for critical work.
   * Requires a documented reason and an approving identity.
   */
  @Post('override')
  @UseGuards(AuthGuard('jwt'))
  async createOverride(@Body() dto: BudgetOverrideDto) {
    return this.budgetService.createOverride(dto);
  }

  /**
   * Pre-flight budget check — call this before creating a bounty to see
   * whether the reward would be within the current budget.
   * Does NOT modify any state; safe to call without side effects.
   */
  @Post('check')
  @UseGuards(AuthGuard('jwt'))
  async checkBudget(@Body() dto: BudgetCheckDto) {
    return this.budgetService.checkBudget(dto);
  }

  // ── Read (public for dashboard visibility) ─────────────────────────────────

  /**
   * Budget utilisation dashboard — spent vs remaining per project/period.
   * Supports optional ?projectId= and ?period= filters.
   */
  @Get('dashboard')
  async getDashboard(
    @Query('projectId') projectId?: string,
    @Query('period') period?: string,
  ) {
    const query: BudgetDashboardQueryDto = { projectId, period };
    return this.budgetService.getDashboard(query);
  }

  /**
   * Historical budget actuals for a project — all quarters.
   * Useful for post-mortems and trend analysis.
   */
  @Get('history/:projectId')
  async getHistoricalActuals(@Param('projectId') projectId: string) {
    return this.budgetService.getHistoricalActuals(projectId);
  }

  /**
   * Fetch a single budget by project + period.
   */
  @Get(':projectId/:period')
  async getBudget(
    @Param('projectId') projectId: string,
    @Param('period') period: string,
  ) {
    return this.budgetService.getBudgetByProjectPeriod(projectId, period);
  }
}
