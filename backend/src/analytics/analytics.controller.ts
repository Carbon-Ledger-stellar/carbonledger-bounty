import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { TrendQueryDto, ReportQueryDto, PaginationQueryDto } from './analytics.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('maintainer')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  // ── Core metrics ─────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/analytics/metrics
   * Current platform metrics: open bounties, pending apps, velocity, completion rate.
   */
  @Get('metrics')
  async getMetrics() {
    return this.analytics.getCoreMetrics();
  }

  // ── Trend analysis ────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/analytics/trends?window=7d|30d|90d
   * Per-day breakdown with acceleration/deceleration signal.
   */
  @Get('trends')
  async getTrends(@Query() query: TrendQueryDto) {
    return this.analytics.getTrendAnalysis(query.window ?? '30d');
  }

  // ── Retention cohorts ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/analytics/retention
   * Monthly cohorts showing % of contributors returning for 2nd and 3rd bounty.
   */
  @Get('retention')
  async getRetention() {
    return this.analytics.getRetentionCohorts();
  }

  // ── Payment distribution ──────────────────────────────────────────────────────

  /**
   * GET /api/v1/analytics/distribution
   * Top-20 contributors, Gini coefficient, and top-20% share of total payouts.
   */
  @Get('distribution')
  async getDistribution() {
    return this.analytics.getPaymentDistribution();
  }

  // ── Snapshots ────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/analytics/snapshots?limit=48
   * Recent hourly snapshots for sparklines.
   */
  @Get('snapshots')
  async getSnapshots(@Query() query: PaginationQueryDto) {
    return this.analytics.getRecentSnapshots(query.limit ?? 48);
  }

  // ── PDF report ────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/analytics/report/pdf?period=weekly|monthly|quarterly&endDate=<ISO>
   * Returns a PDF document suitable for stakeholder reviews.
   */
  @Get('report/pdf')
  async downloadPdf(@Query() query: ReportQueryDto, @Res() res: Response) {
    const period = query.period ?? 'monthly';
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    const data = await this.analytics.getReportData(period, endDate);

    const pdf = buildPdfReport(data);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="analytics-${period}-${data.start.slice(0, 10)}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  }

  // ── CSV export ────────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/analytics/report/csv?period=weekly|monthly|quarterly&endDate=<ISO>
   * Returns a CSV file with completions, applications, and distribution data.
   */
  @Get('report/csv')
  async downloadCsv(@Query() query: ReportQueryDto, @Res() res: Response) {
    const period = query.period ?? 'monthly';
    const endDate = query.endDate ? new Date(query.endDate) : undefined;
    const data = await this.analytics.getReportData(period, endDate);

    const csv = buildCsvReport(data);

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="analytics-${period}-${data.start.slice(0, 10)}.csv"`,
    });
    res.send(csv);
  }
}

// ─── PDF Builder (pure-JS, no external dependency) ─────────────────────────────
// Produces a minimal but readable PDF using raw PDF syntax so we don't need
// an additional npm package in the backend.  For richer output swap in PDFKit.

function buildPdfReport(data: Awaited<ReturnType<AnalyticsService['getReportData']>>): Buffer {
  const lines: string[] = [];
  const periodLabel = data.period.charAt(0).toUpperCase() + data.period.slice(1);

  lines.push(`CarbonLedger Bounty Analytics — ${periodLabel} Report`);
  lines.push(`Period: ${data.start.slice(0, 10)} → ${data.end.slice(0, 10)}`);
  lines.push('');
  lines.push('SUMMARY');
  lines.push(`  Completions       : ${data.completions}`);
  lines.push(`  Applications      : ${data.applications}`);
  lines.push(`  Total Paid (USD)  : $${data.totalPaidUsd.toFixed(2)}`);
  lines.push(`  Avg Time to Complete: ${data.avgTimeToCompleteHours != null ? data.avgTimeToCompleteHours + ' hours' : 'N/A'}`);
  lines.push(`  Cost per Task     : ${data.costPerTask != null ? '$' + data.costPerTask.toFixed(2) : 'N/A'}`);
  lines.push('');
  lines.push('RETENTION');
  lines.push(`  Overall 2nd Bounty Retention : ${data.retention.overallRetentionFor2nd}%`);
  lines.push(`  Overall 3rd Bounty Retention : ${data.retention.overallRetentionFor3rd}%`);
  lines.push('');
  lines.push('PAYMENT DISTRIBUTION');
  lines.push(`  Top 20% Earners Share : ${data.distribution.topPercentileEarningsPct}%`);
  lines.push(`  Gini Coefficient      : ${data.distribution.giniCoefficient}`);
  lines.push(`  Total Contributors    : ${data.distribution.totalContributors}`);
  lines.push('');
  lines.push('TOP 10 CONTRIBUTORS');
  lines.push('  Rank | Contributor (truncated)             | Earned USD | Completions | % of Total');
  for (const b of data.distribution.buckets.slice(0, 10)) {
    const id = b.contributorId.length > 20 ? b.contributorId.slice(0, 8) + '...' + b.contributorId.slice(-8) : b.contributorId;
    lines.push(
      `  ${String(b.rank).padStart(4)} | ${id.padEnd(36)} | $${String(b.totalEarnedUsd.toFixed(2)).padStart(10)} | ${String(b.completions).padStart(11)} | ${b.pctOfTotalPayout}%`,
    );
  }
  lines.push('');
  lines.push('COHORT RETENTION BREAKDOWN');
  lines.push('  Month   | Cohort | 2nd% | 3rd%');
  for (const c of data.retention.cohorts) {
    lines.push(`  ${c.cohortMonth} | ${String(c.contributorsInCohort).padStart(6)} | ${String(c.returnedFor2ndPct).padStart(4)}% | ${String(c.returnedFor3rdPct).padStart(4)}%`);
  }
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);

  const body = lines.join('\n');

  // Minimal valid PDF structure (text only)
  const streamContent = `BT\n/F1 10 Tf\n12 TL\n72 720 Td\n${
    lines.map(l => `(${l.replace(/[()\\]/g, '\\$&')}) Tj T*`).join('\n')
  }\nET`;

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj',
  );
  objects.push(
    `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`,
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj',
  );

  const header = '%PDF-1.4\n';
  let offset = header.length;
  const offsets: number[] = [];
  const body2 = objects
    .map((o, i) => {
      offsets.push(offset);
      const line = `${i + 1} 0 obj\n` + o.split('\n').slice(1).join('\n') + '\n';
      // rebuild properly
      const raw = o + '\n';
      offset += raw.length;
      return raw;
    })
    .join('');

  // Recalculate properly
  let pdf = header;
  const xrefOffsets: number[] = [];
  for (const o of objects) {
    xrefOffsets.push(pdf.length);
    pdf += o + '\n';
  }
  const xrefPos = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const off of xrefOffsets) {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefPos}\n`;
  pdf += '%%EOF';

  return Buffer.from(pdf, 'latin1');
}

// ─── CSV Builder ─────────────────────────────────────────────────────────────

function csvRow(cells: (string | number | null)[]): string {
  return cells
    .map(c => {
      if (c == null) return '';
      const s = String(c);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(',');
}

function buildCsvReport(data: Awaited<ReturnType<AnalyticsService['getReportData']>>): string {
  const sections: string[] = [];

  // ── Summary ──────────────────────────────────────────────────────────────────
  sections.push('SECTION,Report Summary');
  sections.push(csvRow(['Period', data.period]));
  sections.push(csvRow(['Start', data.start.slice(0, 10)]));
  sections.push(csvRow(['End', data.end.slice(0, 10)]));
  sections.push(csvRow(['Completions', data.completions]));
  sections.push(csvRow(['Applications', data.applications]));
  sections.push(csvRow(['Total Paid USD', data.totalPaidUsd]));
  sections.push(csvRow(['Avg Time to Complete (hours)', data.avgTimeToCompleteHours]));
  sections.push(csvRow(['Cost per Task USD', data.costPerTask]));
  sections.push('');

  // ── Retention ────────────────────────────────────────────────────────────────
  sections.push('SECTION,Retention Cohorts');
  sections.push(csvRow(['Overall 2nd Bounty Retention %', data.retention.overallRetentionFor2nd]));
  sections.push(csvRow(['Overall 3rd Bounty Retention %', data.retention.overallRetentionFor3rd]));
  sections.push('');
  sections.push(csvRow(['Cohort Month', 'Contributors', 'Returned for 2nd', '2nd %', 'Returned for 3rd', '3rd %']));
  for (const c of data.retention.cohorts) {
    sections.push(
      csvRow([c.cohortMonth, c.contributorsInCohort, c.returnedFor2nd, c.returnedFor2ndPct, c.returnedFor3rd, c.returnedFor3rdPct]),
    );
  }
  sections.push('');

  // ── Distribution ────────────────────────────────────────────────────────────
  sections.push('SECTION,Payment Distribution');
  sections.push(csvRow(['Top 20% Earners Share %', data.distribution.topPercentileEarningsPct]));
  sections.push(csvRow(['Gini Coefficient', data.distribution.giniCoefficient]));
  sections.push(csvRow(['Total Contributors', data.distribution.totalContributors]));
  sections.push(csvRow(['Total Payouts USD', data.distribution.totalPayoutsUsd]));
  sections.push('');
  sections.push(csvRow(['Rank', 'Contributor ID', 'Total Earned USD', 'Completions', '% of Total Payout']));
  for (const b of data.distribution.buckets) {
    sections.push(csvRow([b.rank, b.contributorId, b.totalEarnedUsd, b.completions, b.pctOfTotalPayout]));
  }
  sections.push('');

  // ── Completions detail ────────────────────────────────────────────────────────
  sections.push('SECTION,Completions Detail');
  sections.push(csvRow(['Bounty ID', 'Title', 'Contributor', 'Reward USD', 'Difficulty', 'Type', 'Completed At', 'Hours to Complete']));
  for (const c of data.completionRows) {
    sections.push(
      csvRow([
        c.bountyId,
        c.bountyTitle,
        c.contributorId,
        c.rewardUsd,
        c.difficulty,
        c.bountyType,
        c.completedAt.toISOString(),
        c.hoursToComplete ?? '',
      ]),
    );
  }
  sections.push('');

  // ── Applications detail ──────────────────────────────────────────────────────
  sections.push('SECTION,Applications Detail');
  sections.push(csvRow(['Bounty ID', 'Title', 'Applicant', 'Status', 'Reward USD', 'Applied At']));
  for (const a of data.applicationRows) {
    sections.push(csvRow([a.bountyId, a.bountyTitle, a.applicantId, a.status, a.rewardUsd, a.appliedAt.toISOString()]));
  }

  return sections.join('\n');
}
