'use client';

import { useState } from 'react';
import {
  useAnalyticsMetrics,
  useAnalyticsTrends,
  useAnalyticsRetention,
  useAnalyticsDistribution,
  useAnalyticsSnapshots,
  type TrendPoint,
  type CohortRow,
  type DistributionBucket,
  type AnalyticsSnapshot,
} from '../../../lib/api';
import { colors, spacing, shadows, borderRadius, fonts } from '../../../styles/design-system';

// ── Token gate ────────────────────────────────────────────────────────────────
// In production wire to your auth context / cookie.  For this reference
// implementation the maintainer pastes their JWT so the demo works without
// a full auth session.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// ── Design helpers ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: borderRadius.lg,
  padding: spacing.lg,
  boxShadow: shadows.sm,
  border: `1px solid ${colors.neutral[200]}`,
};

function SectionHeader({ id, title, sub }: { id?: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: spacing.md }}>
      <h2 id={id} style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: colors.neutral[900] }}>
        {title}
      </h2>
      {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: colors.neutral[500] }}>{sub}</p>}
    </div>
  );
}

function Skeleton({ height = 120 }: { height?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        borderRadius: borderRadius.md,
        backgroundColor: colors.neutral[100],
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number | null;
  sub?: string;
  accent?: string;
  loading?: boolean;
}

function MetricCard({ label, value, sub, accent = colors.primary[500], loading }: MetricCardProps) {
  if (loading) return <Skeleton height={96} />;
  return (
    <div
      style={{
        ...card,
        borderLeft: `4px solid ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.75rem', fontWeight: 800, color: colors.neutral[900], lineHeight: 1 }}>
        {value ?? '—'}
      </span>
      {sub && <span style={{ fontSize: '0.8rem', color: colors.neutral[500] }}>{sub}</span>}
    </div>
  );
}

// ── Trend velocity badge ──────────────────────────────────────────────────────

function VelocityBadge({ trend, pct }: { trend: 'accelerating' | 'decelerating' | 'stable'; pct: number }) {
  const cfg = {
    accelerating: { bg: '#dcfce7', text: '#166534', icon: '↑' },
    decelerating: { bg: '#fee2e2', text: '#991b1b', icon: '↓' },
    stable:        { bg: '#f3f4f6', text: '#374151', icon: '→' },
  }[trend];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '0.8rem',
        fontWeight: 700,
        backgroundColor: cfg.bg,
        color: cfg.text,
      }}
    >
      {cfg.icon} {trend} ({pct > 0 ? '+' : ''}{pct}%)
    </span>
  );
}

// ── Mini SVG bar chart ────────────────────────────────────────────────────────

function BarChart({
  points,
  field,
  color = colors.primary[500],
  height = 80,
}: {
  points: TrendPoint[];
  field: keyof TrendPoint;
  color?: string;
  height?: number;
}) {
  if (!points.length) return <div style={{ height }} />;
  const values = points.map(p => Number(p[field] ?? 0));
  const max = Math.max(...values, 1);
  const barW = Math.max(2, Math.floor(600 / points.length) - 2);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${points.length * (barW + 2)} ${height}`}
      preserveAspectRatio="none"
      aria-label="Bar chart"
      role="img"
      style={{ display: 'block' }}
    >
      {points.map((p, i) => {
        const v = Number(p[field] ?? 0);
        const barH = Math.max(1, Math.round((v / max) * (height - 4)));
        return (
          <rect
            key={p.date}
            x={i * (barW + 2)}
            y={height - barH}
            width={barW}
            height={barH}
            fill={color}
            opacity={0.85}
            rx={1}
          >
            <title>{p.date}: {v}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// ── Mini sparkline ────────────────────────────────────────────────────────────

function Sparkline({
  data,
  color = colors.primary[500],
  height = 48,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const w = 200;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - Math.round((v / max) * (height - 4))} `).join('');
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Retention cohort table ────────────────────────────────────────────────────

function RetentionTable({ cohorts, loading }: { cohorts: CohortRow[] | undefined; loading: boolean }) {
  if (loading) return <Skeleton height={200} />;
  if (!cohorts?.length) {
    return (
      <p style={{ color: colors.neutral[500], textAlign: 'center', padding: spacing.lg }}>
        No cohort data yet. Completions will appear here once contributors finish bounties.
      </p>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ backgroundColor: colors.neutral[50] }}>
            {['Cohort', 'Contributors', '2nd Bounty', '2nd %', '3rd Bounty', '3rd %'].map(h => (
              <th
                key={h}
                style={{
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  fontWeight: 700,
                  color: colors.neutral[700],
                  borderBottom: `2px solid ${colors.neutral[200]}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((row, i) => (
            <tr
              key={row.cohortMonth}
              style={{ backgroundColor: i % 2 === 0 ? 'white' : colors.neutral[50] }}
            >
              <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{row.cohortMonth}</td>
              <td style={{ padding: '0.5rem 0.75rem' }}>{row.contributorsInCohort}</td>
              <td style={{ padding: '0.5rem 0.75rem' }}>{row.returnedFor2nd}</td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                <RetentionBar pct={row.returnedFor2ndPct} />
              </td>
              <td style={{ padding: '0.5rem 0.75rem' }}>{row.returnedFor3rd}</td>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                <RetentionBar pct={row.returnedFor3rdPct} color={colors.accent[500]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetentionBar({ pct, color = colors.primary[500] }: { pct: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: 8, backgroundColor: colors.neutral[100], borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: colors.neutral[700], minWidth: '3rem', textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Distribution table ────────────────────────────────────────────────────────

function DistributionTable({ buckets, totalPayout, loading }: { buckets: DistributionBucket[] | undefined; totalPayout: number; loading: boolean }) {
  if (loading) return <Skeleton height={200} />;
  if (!buckets?.length) {
    return (
      <p style={{ color: colors.neutral[500], textAlign: 'center', padding: spacing.lg }}>
        No payout data yet.
      </p>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ backgroundColor: colors.neutral[50] }}>
            {['Rank', 'Contributor', 'Earned (USD)', 'Completions', '% of Total'].map(h => (
              <th
                key={h}
                style={{
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  fontWeight: 700,
                  color: colors.neutral[700],
                  borderBottom: `2px solid ${colors.neutral[200]}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => {
            const shortId = b.contributorId.length > 16
              ? b.contributorId.slice(0, 6) + '…' + b.contributorId.slice(-6)
              : b.contributorId;
            return (
              <tr key={b.rank} style={{ backgroundColor: i % 2 === 0 ? 'white' : colors.neutral[50] }}>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: i < 3 ? colors.primary[600] : colors.neutral[700] }}>
                  #{b.rank}
                </td>
                <td style={{ padding: '0.5rem 0.75rem', fontFamily: fonts.mono, fontSize: '0.8rem' }}>
                  {shortId}
                </td>
                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>
                  ${b.totalEarnedUsd.toLocaleString()}
                </td>
                <td style={{ padding: '0.5rem 0.75rem' }}>{b.completions}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                  <RetentionBar pct={b.pctOfTotalPayout} color={colors.semantic.info} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Snapshot sparkline row ────────────────────────────────────────────────────

function SnapshotSparklines({ snapshots, loading }: { snapshots: AnalyticsSnapshot[] | undefined; loading: boolean }) {
  if (loading) return <Skeleton height={80} />;
  if (!snapshots?.length) return null;

  // Reverse so oldest is on the left
  const ordered = [...snapshots].reverse();
  const open    = ordered.map(s => s.bountiesOpen);
  const done    = ordered.map(s => s.bountiesCompleted);
  const payout  = ordered.map(s => s.totalPayoutsUsd);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: spacing.md,
      }}
    >
      {[
        { label: 'Open bounties (48 h)', data: open, color: colors.primary[500] },
        { label: 'Completions (48 h)',   data: done, color: colors.semantic.success },
        { label: 'Payouts USD (48 h)',   data: payout, color: colors.semantic.info },
      ].map(({ label, data, color }) => (
        <div key={label} style={{ ...card, padding: spacing.sm }}>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', fontWeight: 600, color: colors.neutral[500] }}>{label}</p>
          <Sparkline data={data} color={color} />
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [token, setToken] = useState<string>('');
  const [tokenInput, setTokenInput] = useState('');
  const [trendWindow, setTrendWindow] = useState<'7d' | '30d' | '90d'>('30d');
  const [reportPeriod, setReportPeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly');

  const authed = token.length > 0;

  const { data: metrics, isLoading: metricsLoading } = useAnalyticsMetrics(authed ? token : null);
  const { data: trends,  isLoading: trendsLoading  } = useAnalyticsTrends(authed ? token : null, trendWindow);
  const { data: retention, isLoading: retentionLoading } = useAnalyticsRetention(authed ? token : null);
  const { data: distribution, isLoading: distLoading } = useAnalyticsDistribution(authed ? token : null);
  const { data: snapshots, isLoading: snapshotsLoading } = useAnalyticsSnapshots(authed ? token : null, 48);

  // ── Token gate ──────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <main
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        <div style={{ ...card, maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: spacing.sm, color: colors.neutral[900] }}>
            🔐 Maintainer Access
          </h1>
          <p style={{ color: colors.neutral[500], marginBottom: spacing.md, fontSize: '0.9rem' }}>
            This dashboard is restricted to platform maintainers. Paste your JWT token to continue.
          </p>
          <input
            type="password"
            placeholder="Bearer token…"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && tokenInput.trim()) setToken(tokenInput.trim()); }}
            aria-label="Maintainer JWT token"
            style={{
              width: '100%',
              padding: '0.625rem 0.875rem',
              borderRadius: borderRadius.sm,
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: '0.875rem',
              marginBottom: spacing.sm,
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => { if (tokenInput.trim()) setToken(tokenInput.trim()); }}
            style={{
              width: '100%',
              padding: '0.625rem',
              borderRadius: borderRadius.sm,
              border: 'none',
              backgroundColor: colors.primary[500],
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Access Dashboard
          </button>
        </div>
      </main>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  const computedAt = metrics?.computedAt
    ? new Date(metrics.computedAt).toLocaleString()
    : null;

  return (
    <main
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: `${spacing.xl} ${spacing.lg}`,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xl,
      }}
    >
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing.sm }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, color: colors.neutral[900] }}>
            📊 Analytics Dashboard
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: colors.neutral[500], fontSize: '0.9rem' }}>
            Maintainer view · {computedAt ? `Last computed ${computedAt}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => setToken('')}
          aria-label="Sign out"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: borderRadius.sm,
            border: `1px solid ${colors.neutral[200]}`,
            backgroundColor: 'white',
            color: colors.neutral[700],
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          Sign out
        </button>
      </div>

      {/* ── Core metrics grid ── */}
      <section aria-labelledby="metrics-heading">
        <SectionHeader id="metrics-heading" title="Core Metrics" sub="Computed hourly from bounty activity" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: spacing.md,
          }}
        >
          <MetricCard label="Bounties Open"         value={metrics?.bountiesOpen ?? null}           loading={metricsLoading} accent={colors.primary[500]} />
          <MetricCard label="Applications Pending"  value={metrics?.applicationsPending ?? null}    loading={metricsLoading} accent={colors.accent[500]} />
          <MetricCard label="Completion Rate"        value={metrics ? `${metrics.completionRate}%` : null} loading={metricsLoading} accent={colors.semantic.success} />
          <MetricCard
            label="Avg Time to Complete"
            value={metrics?.avgTimeToCompleteHours != null ? `${metrics.avgTimeToCompleteHours}h` : '—'}
            loading={metricsLoading}
            accent={colors.semantic.warning}
          />
          <MetricCard
            label="Cost per Task"
            value={metrics?.costPerTask != null ? `$${metrics.costPerTask}` : '—'}
            loading={metricsLoading}
            accent={colors.semantic.info}
          />
          <MetricCard label="Total Completions"     value={metrics?.totalCompletions ?? null}       loading={metricsLoading} accent={colors.primary[600]} />
          <MetricCard label="Total Payouts (USD)"   value={metrics ? `$${metrics.totalPayoutsUsd.toLocaleString()}` : null} loading={metricsLoading} accent={colors.semantic.success} />
          <MetricCard label="Unique Contributors"   value={metrics?.uniqueContributors ?? null}     loading={metricsLoading} accent={colors.accent[600]} />
        </div>
      </section>

      {/* ── 48-hour sparklines ── */}
      <section aria-labelledby="sparklines-heading">
        <SectionHeader id="sparklines-heading" title="48-Hour Sparklines" sub="Hourly snapshot history" />
        <SnapshotSparklines snapshots={snapshots} loading={snapshotsLoading} />
      </section>

      {/* ── Trend analysis ── */}
      <section aria-labelledby="trends-heading">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          <SectionHeader id="trends-heading" title="Trend Analysis" sub="Daily completions and application volume" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['7d', '30d', '90d'] as const).map(w => (
              <button
                key={w}
                onClick={() => setTrendWindow(w)}
                aria-pressed={trendWindow === w}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: borderRadius.sm,
                  border: `1px solid ${trendWindow === w ? colors.primary[500] : colors.neutral[200]}`,
                  backgroundColor: trendWindow === w ? colors.primary[50] : 'white',
                  color: trendWindow === w ? colors.primary[700] : colors.neutral[700],
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {trendsLoading ? (
          <Skeleton height={160} />
        ) : trends ? (
          <div style={{ ...card }}>
            {/* Velocity status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' }}>
              <VelocityBadge trend={trends.completionVelocityTrend} pct={trends.completionGrowthPct} />
              <span style={{ fontSize: '0.875rem', color: colors.neutral[500] }}>
                Prev half avg: {trends.previousWindowAvgCompletions}/day → Current: {trends.currentWindowAvgCompletions}/day
              </span>
            </div>

            {/* Bar chart */}
            <div style={{ marginBottom: spacing.md }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: colors.neutral[500] }}>
                Daily completions ({trendWindow})
              </p>
              <BarChart points={trends.points} field="completions" color={colors.primary[500]} height={100} />
            </div>

            <div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: colors.neutral[500] }}>
                Pending applications ({trendWindow})
              </p>
              <BarChart points={trends.points} field="applicationsPending" color={colors.accent[500]} height={80} />
            </div>

            {/* Window comparison table */}
            <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.neutral[100]}` }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: colors.neutral[500] }}>Window comparison</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.sm }}>
                {(['7d', '30d', '90d'] as const).map(w => {
                  const c = trends.comparison[w];
                  return (
                    <div key={w} style={{ textAlign: 'center', padding: spacing.sm, backgroundColor: colors.neutral[50], borderRadius: borderRadius.md }}>
                      <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: colors.neutral[900] }}>{c.completions}</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: colors.neutral[500] }}>completions ({w})</p>
                      {c.avgVelocity != null && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: colors.neutral[500] }}>{c.avgVelocity}h avg</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Retention cohorts ── */}
      <section aria-labelledby="retention-heading">
        <SectionHeader
          id="retention-heading"
          title="Contributor Retention Cohorts"
          sub={
            retention
              ? `Overall: ${retention.overallRetentionFor2nd}% return for a 2nd bounty · ${retention.overallRetentionFor3rd}% for a 3rd`
              : 'Monthly cohorts showing repeat-contributor rates'
          }
        />
        <div style={card}>
          <RetentionTable cohorts={retention?.cohorts} loading={retentionLoading} />
        </div>
      </section>

      {/* ── Payment distribution ── */}
      <section aria-labelledby="distribution-heading">
        <SectionHeader
          id="distribution-heading"
          title="Payment Distribution"
          sub={
            distribution
              ? `Top 20% earn ${distribution.topPercentileEarningsPct}% of total payouts · Gini: ${distribution.giniCoefficient}`
              : 'Top-20 contributors by total earnings'
          }
        />
        <div style={card}>
          <DistributionTable
            buckets={distribution?.buckets}
            totalPayout={distribution?.totalPayoutsUsd ?? 0}
            loading={distLoading}
          />
        </div>
      </section>

      {/* ── Export reports ── */}
      <section aria-labelledby="export-heading">
        <SectionHeader id="export-heading" title="Export Reports" sub="Weekly, monthly, and quarterly stakeholder reports" />
        <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' }}>
          <div>
            <label htmlFor="report-period" style={{ fontSize: '0.875rem', fontWeight: 600, color: colors.neutral[700], marginRight: '0.5rem' }}>
              Period:
            </label>
            <select
              id="report-period"
              value={reportPeriod}
              onChange={e => setReportPeriod(e.target.value as typeof reportPeriod)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: borderRadius.sm,
                border: `1px solid ${colors.neutral[200]}`,
                fontSize: '0.875rem',
                backgroundColor: 'white',
              }}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          <a
            href={`${API_URL}/analytics/report/pdf?period=${reportPeriod}`}
            download
            onClick={e => {
              // Inject auth header via fetch + blob trick
              e.preventDefault();
              fetch(`${API_URL}/analytics/report/pdf?period=${reportPeriod}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
                .then(r => r.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `analytics-${reportPeriod}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                });
            }}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: borderRadius.sm,
              backgroundColor: colors.semantic.error,
              color: 'white',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            ⬇ PDF Report
          </a>

          <a
            href={`${API_URL}/analytics/report/csv?period=${reportPeriod}`}
            download
            onClick={e => {
              e.preventDefault();
              fetch(`${API_URL}/analytics/report/csv?period=${reportPeriod}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
                .then(r => r.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `analytics-${reportPeriod}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                });
            }}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: borderRadius.sm,
              backgroundColor: colors.semantic.success,
              color: 'white',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
          >
            ⬇ CSV Export
          </a>
        </div>
      </section>
    </main>
  );
}
