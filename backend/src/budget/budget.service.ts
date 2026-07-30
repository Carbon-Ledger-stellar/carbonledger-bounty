import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  BudgetCheckDto,
  BudgetCheckResult,
  BudgetDashboardQueryDto,
  BudgetOverrideDto,
  BudgetUtilizationItem,
  CreateBudgetDto,
} from './budget.dto';

/** Fraction of budget that triggers a warning notification. */
const WARNING_THRESHOLD = 0.8;

/** Maximum extra allocation an override may add, as a fraction of the base amount. */
const MAX_OVERRIDE_FRACTION = 0.2;

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Budget CRUD ─────────────────────────────────────────────────────────────

  /**
   * Create or update a quarterly budget for a project.
   * If a budget already exists for (projectId, period) its amount is replaced.
   */
  async upsertBudget(dto: CreateBudgetDto) {
    const budget = await this.prisma.projectBudget.upsert({
      where: { projectId_period: { projectId: dto.projectId, period: dto.period } },
      update: { amount: dto.amount },
      create: {
        projectId: dto.projectId,
        period: dto.period,
        amount: dto.amount,
        spent: 0,
      },
    });

    this.logger.log(
      `Budget upserted: ${budget.id} — ${dto.projectId}/${dto.period} $${dto.amount}`,
    );
    return budget;
  }

  /**
   * Retrieve a single budget by its DB id.
   */
  async getBudgetById(id: string) {
    const budget = await this.prisma.projectBudget.findUnique({ where: { id } });
    if (!budget) throw new NotFoundException(`Budget ${id} not found`);
    return budget;
  }

  /**
   * Retrieve a budget by project + period.
   */
  async getBudgetByProjectPeriod(projectId: string, period: string) {
    const budget = await this.prisma.projectBudget.findUnique({
      where: { projectId_period: { projectId, period } },
    });
    if (!budget) {
      throw new NotFoundException(
        `No budget found for project "${projectId}" in period "${period}"`,
      );
    }
    return budget;
  }

  // ── Budget check (called before bounty creation) ────────────────────────────

  /**
   * Check whether creating a new bounty with the given reward would stay within
   * the budget for (projectId, period). Returns the check result; does NOT throw
   * unless the budget record itself is missing.
   *
   * Callers should call `recordSpend` after the bounty is committed.
   */
  async checkBudget(dto: BudgetCheckDto): Promise<BudgetCheckResult> {
    const budget = await this.prisma.projectBudget.findUnique({
      where: { projectId_period: { projectId: dto.projectId, period: dto.period } },
      include: { overrides: true },
    });

    if (!budget) {
      throw new NotFoundException(
        `No budget configured for project "${dto.projectId}" in period "${dto.period}". ` +
          'Create one via POST /api/v1/budget before posting bounties.',
      );
    }

    const overrideSurplus = budget.overrides.reduce(
      (sum, o) => sum + o.amountApproved,
      0,
    );
    const effectiveCap = budget.amount + overrideSurplus;
    const projectedSpend = budget.spent + dto.rewardUsd;
    const utilizationPct = projectedSpend / effectiveCap;

    const frozen = budget.spent >= effectiveCap;
    const wouldExceed = projectedSpend > effectiveCap;

    const result: BudgetCheckResult = {
      allowed: !frozen && !wouldExceed,
      utilizationPct: Math.round(utilizationPct * 10000) / 100, // two decimals
      warning: utilizationPct >= WARNING_THRESHOLD,
      budget: {
        id: budget.id,
        projectId: budget.projectId,
        period: budget.period,
        amount: budget.amount,
        spent: budget.spent,
        effectiveCap,
      },
    };

    if (frozen) {
      result.reason = `Budget for "${dto.projectId}/${dto.period}" is fully exhausted ($${budget.spent} / $${effectiveCap}).`;
    } else if (wouldExceed) {
      const shortfall = projectedSpend - effectiveCap;
      result.reason =
        `Adding this bounty ($${dto.rewardUsd}) would exceed the budget by $${shortfall.toFixed(2)}. ` +
        `Remaining capacity: $${(effectiveCap - budget.spent).toFixed(2)}.`;
    }

    return result;
  }

  /**
   * Atomically record spend after a bounty has been committed.
   * Also fires budget alerts if thresholds are crossed.
   */
  async recordSpend(projectId: string, period: string, amount: number): Promise<void> {
    const budget = await this.prisma.projectBudget.findUnique({
      where: { projectId_period: { projectId, period } },
      include: { overrides: true, alerts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!budget) {
      this.logger.warn(
        `recordSpend: no budget for ${projectId}/${period} — spend of $${amount} not tracked`,
      );
      return;
    }

    const updated = await this.prisma.projectBudget.update({
      where: { id: budget.id },
      data: { spent: { increment: amount } },
    });

    const overrideSurplus = budget.overrides.reduce((s, o) => s + o.amountApproved, 0);
    const effectiveCap = budget.amount + overrideSurplus;
    const utilization = updated.spent / effectiveCap;

    await this.evaluateAlerts(budget.id, projectId, period, utilization, effectiveCap, updated.spent);
  }

  // ── Budget override ─────────────────────────────────────────────────────────

  /**
   * Approve an override that extends the budget by up to 20% of the base
   * allocation. Throws if the requested surplus would exceed that cap.
   */
  async createOverride(dto: BudgetOverrideDto) {
    const budget = await this.prisma.projectBudget.findUnique({
      where: { id: dto.budgetId },
      include: { overrides: true },
    });

    if (!budget) throw new NotFoundException(`Budget ${dto.budgetId} not found`);

    const existingOverrideSurplus = budget.overrides.reduce(
      (sum, o) => sum + o.amountApproved,
      0,
    );
    const maxAllowedOverride = budget.amount * MAX_OVERRIDE_FRACTION;
    const newTotal = existingOverrideSurplus + dto.amountApproved;

    if (newTotal > maxAllowedOverride) {
      throw new BadRequestException(
        `Override would bring total overrides to $${newTotal.toFixed(2)}, ` +
          `exceeding the ${MAX_OVERRIDE_FRACTION * 100}% cap of $${maxAllowedOverride.toFixed(2)}.`,
      );
    }

    const override = await this.prisma.budgetOverride.create({
      data: {
        budgetId: dto.budgetId,
        approvedBy: dto.approvedBy,
        amountApproved: dto.amountApproved,
        reason: dto.reason,
        bountyId: dto.bountyId ?? null,
      },
    });

    this.logger.log(
      `Override created for budget ${dto.budgetId}: +$${dto.amountApproved} by ${dto.approvedBy}`,
    );
    return override;
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  /**
   * Return utilisation metrics for all budgets matching the optional filters.
   */
  async getDashboard(query: BudgetDashboardQueryDto): Promise<BudgetUtilizationItem[]> {
    const budgets = await this.prisma.projectBudget.findMany({
      where: {
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.period ? { period: query.period } : {}),
      },
      include: {
        overrides: { orderBy: { createdAt: 'desc' } },
        alerts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: [{ projectId: 'asc' }, { period: 'desc' }],
    });

    return budgets.map(b => {
      const overrideSurplus = b.overrides.reduce((s, o) => s + o.amountApproved, 0);
      const effectiveCap = b.amount + overrideSurplus;
      const remaining = Math.max(0, effectiveCap - b.spent);
      const utilizationPct = effectiveCap > 0 ? (b.spent / effectiveCap) * 100 : 0;

      let status: 'ok' | 'warning' | 'frozen';
      if (b.spent >= effectiveCap) {
        status = 'frozen';
      } else if (b.spent / effectiveCap >= WARNING_THRESHOLD) {
        status = 'warning';
      } else {
        status = 'ok';
      }

      return {
        id: b.id,
        projectId: b.projectId,
        period: b.period,
        amount: b.amount,
        spent: b.spent,
        remaining,
        effectiveCap,
        utilizationPct: Math.round(utilizationPct * 100) / 100,
        status,
        overrides: b.overrides.map(o => ({
          id: o.id,
          approvedBy: o.approvedBy,
          amountApproved: o.amountApproved,
          reason: o.reason,
          bountyId: o.bountyId ?? undefined,
          createdAt: o.createdAt,
        })),
        recentAlerts: b.alerts.map(a => ({
          id: a.id,
          alertType: a.alertType,
          utilization: a.utilization,
          message: a.message,
          createdAt: a.createdAt,
        })),
      };
    });
  }

  /**
   * Historical actuals — all budget records for a project across periods,
   * useful for post-mortems.
   */
  async getHistoricalActuals(projectId: string): Promise<BudgetUtilizationItem[]> {
    return this.getDashboard({ projectId });
  }

  // ── Alert logic ─────────────────────────────────────────────────────────────

  /**
   * Fire and persist alerts when utilisation crosses 80% or 100%.
   * Deduplicates within the same alert level so repeated spends don't spam.
   */
  private async evaluateAlerts(
    budgetId: string,
    projectId: string,
    period: string,
    utilization: number,
    effectiveCap: number,
    spent: number,
  ): Promise<void> {
    const isFrozen = spent >= effectiveCap;
    const isWarning = utilization >= WARNING_THRESHOLD;

    if (!isWarning) return;

    const alertType = isFrozen ? 'freeze' : 'warning';
    const message = isFrozen
      ? `Budget for "${projectId}/${period}" is fully consumed ($${spent.toFixed(2)} / $${effectiveCap.toFixed(2)}). New bounties are blocked.`
      : `Budget for "${projectId}/${period}" has reached ${(utilization * 100).toFixed(1)}% utilisation ($${spent.toFixed(2)} / $${effectiveCap.toFixed(2)}). Maintainers should review.`;

    // Avoid duplicate alerts of the same type created within the same hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await this.prisma.budgetAlert.findFirst({
      where: {
        budgetId,
        alertType,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (existing) return; // already notified recently

    await this.prisma.budgetAlert.create({
      data: {
        budgetId,
        alertType,
        utilization,
        message,
        notified: false,
      },
    });

    this.logger.warn(`[BUDGET ALERT] ${alertType.toUpperCase()}: ${message}`);

    // Emit to notification layer — in production wire to email transport
    this.emitMaintainerAlert(alertType, projectId, period, message);
  }

  /**
   * Simulated maintainer alert emission.
   * In production replace with NodeMailer / SES / Slack webhook.
   */
  private emitMaintainerAlert(
    alertType: 'warning' | 'freeze',
    projectId: string,
    period: string,
    message: string,
  ): void {
    // TODO: integrate with real email/webhook transport
    this.logger.log(
      `[NOTIFY MAINTAINERS] ${alertType} alert for ${projectId}/${period}: ${message}`,
    );
  }
}
