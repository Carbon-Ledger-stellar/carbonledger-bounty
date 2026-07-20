'use client';

import { use } from 'react';
import {
  usePortfolioDashboard,
  usePortfolioPipeline,
  usePortfolioMilestones,
  useSkillGrowth,
  useEarningsProjection,
  PIPELINE_STAGES,
  PipelineStage,
} from '../../../lib/portfolio-api';
import { colors, spacing, shadows, borderRadius } from '../../../styles/design-system';
import Link from 'next/link';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  applied: '📋 Applied',
  claimed: '🔒 Claimed',
  'in-progress': '⚙️ In Progress',
  submitted: '📤 Submitted',
  'under-review': '🔍 Under Review',
  completed: '✅ Completed',
};

const STAGE_COLORS: Record<PipelineStage, { bg: string; border: string; text: string }> = {
  applied: { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
  claimed: { bg: '#fef9c3', border: '#fde047', text: '#854d0e' },
  'in-progress': { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
  submitted: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  'under-review': { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8' },
  completed: { bg: '#f0fdf4', border: colors.primary[500], text: '#065f46' },
};

function Skeleton({ width = '100%', height = '1.5rem' }: { width?: string; height?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{ width, height, backgroundColor: colors.neutral[200], borderRadius: borderRadius.sm }}
    />
  );
}

function StatCard({ label, value, color = colors.primary[500], loading = false }: {
  label: string; value: string; color?: string; loading?: boolean;
}) {
  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.9)',
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      boxShadow: shadows.md,
      flex: '1 1 160px',
      minWidth: 140,
      borderLeft: `4px solid ${color}`,
    }}>
      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: colors.neutral[500], textTransform: 'uppercase' }}>
        {label}
      </p>
      {loading ? <Skeleton height="2rem" /> : (
        <p style={{ margin: '0.4rem 0 0', fontSize: '1.75rem', fontWeight: 800, color: colors.neutral[900] }}>
          {value}
        </p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ contributorId: string }>;
}

export default function ContributorPortfolioPage({ params }: Props) {
  const { contributorId } = use(params);

  const { data: dashboard, isLoading: dashLoading, error: dashError } = usePortfolioDashboard(contributorId);
  const { data: pipeline, isLoading: pipeLoading } = usePortfolioPipeline(contributorId);
  const { data: milestones, isLoading: milesLoading } = usePortfolioMilestones(contributorId);
  const { data: skills } = useSkillGrowth(contributorId);
  const { data: projection } = useEarningsProjection(contributorId);

  if (dashError) {
    return (
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: spacing.lg, textAlign: 'center' }}>
        <p style={{ fontSize: '3rem' }}>🔍</p>
        <h2 style={{ color: colors.neutral[900] }}>Contributor Not Found</h2>
        <p style={{ color: colors.neutral[500] }}>No portfolio found for <strong>{contributorId}</strong>.</p>
        <Link
          href="/portfolio"
          style={{ color: colors.primary[500], fontWeight: 600, textDecoration: 'none' }}
        >
          ← Back to Portfolio Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
        borderBottom: `2px solid ${colors.primary[500]}`,
        padding: `${spacing.xl} ${spacing.lg}`,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <Link href="/portfolio" style={{ color: '#6ee7b7', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← All Portfolios
          </Link>
          <h1 style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 800, color: 'white' }}>
            📁 {contributorId}
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#6ee7b7' }}>Contributor Portfolio</p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: `${spacing.xl} ${spacing.lg}` }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.xl }}>
          <StatCard label="Active" value={dashLoading ? '…' : String(dashboard?.activeBounties ?? 0)} color="#3b82f6" loading={dashLoading} />
          <StatCard label="Completed" value={dashLoading ? '…' : String(dashboard?.completedBounties ?? 0)} color={colors.primary[500]} loading={dashLoading} />
          <StatCard label="Earnings" value={dashLoading ? '…' : formatUsd(dashboard?.totalEarnings ?? 0)} color="#10b981" loading={dashLoading} />
          <StatCard label="Rating" value={dashLoading ? '…' : `${dashboard?.rating ?? 0}/5`} color="#f59e0b" loading={dashLoading} />
        </div>

        {/* Kanban pipeline */}
        <h2 style={{ margin: `0 0 ${spacing.sm}`, color: 'white', borderBottom: `2px solid ${colors.primary[500]}`, paddingBottom: '0.5rem' }}>
          🗂️ Pipeline Board
        </h2>
        <div style={{ overflowX: 'auto', marginBottom: spacing.xl }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, minmax(180px, 1fr))`,
            gap: spacing.sm,
            minWidth: 1080,
          }}>
            {PIPELINE_STAGES.map((stage) => {
              const sc = STAGE_COLORS[stage];
              const items = pipeline?.[stage] ?? [];
              return (
                <div key={stage} style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}`, borderRadius: borderRadius.lg, padding: spacing.sm, minHeight: 260 }}>
                  <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: sc.text, fontSize: '0.8rem' }}>
                    {STAGE_LABELS[stage]}
                  </p>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', color: colors.neutral[500] }}>
                    {pipeLoading ? '…' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
                  </p>
                  {pipeLoading ? <Skeleton height="4rem" /> : items.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: colors.neutral[500], fontSize: '0.75rem', border: `2px dashed ${sc.border}`, borderRadius: borderRadius.sm }}>
                      Empty
                    </div>
                  ) : items.map((item) => (
                    <div key={item.id} style={{ backgroundColor: 'white', borderRadius: borderRadius.sm, padding: '0.6rem', marginBottom: '0.4rem', boxShadow: shadows.sm }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.8rem', color: colors.neutral[900] }}>{item.bountyTitle}</p>
                      <p style={{ margin: '0.3rem 0 0', fontWeight: 700, color: colors.primary[600], fontSize: '0.8rem' }}>{formatUsd(item.rewardUsd)}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Milestones + Skills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: spacing.lg, marginBottom: spacing.xl }}>
          <div>
            <h2 style={{ margin: `0 0 ${spacing.sm}`, color: 'white', borderBottom: `2px solid ${colors.primary[500]}`, paddingBottom: '0.5rem' }}>
              🏆 Milestones
            </h2>
            {milesLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[1,2,3].map(i => <Skeleton key={i} height="3rem" />)}
              </div>
            ) : !milestones?.length ? (
              <p style={{ color: colors.neutral[400] }}>No milestones yet.</p>
            ) : milestones.map((m) => (
              <div key={m.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: borderRadius.md, marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{ width: 10, height: 10, minWidth: 10, borderRadius: '50%', backgroundColor: colors.primary[500], marginTop: 4 }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: 'white', fontSize: '0.85rem' }}>{m.bountyTitle}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#6ee7b7' }}>{formatUsd(m.earningsUsd)} · {formatDate(m.completedAt)}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <h2 style={{ margin: `0 0 ${spacing.sm}`, color: 'white', borderBottom: `2px solid ${colors.primary[500]}`, paddingBottom: '0.5rem' }}>
              📈 Skills (Last 90 Days)
            </h2>
            <p style={{ color: colors.neutral[400], fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
              {skills?.length ?? 0} new skill{skills?.length !== 1 ? 's' : ''} acquired
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {skills?.map((s) => (
                <span key={s.skill + s.acquiredAt} style={{ backgroundColor: colors.primary[700], color: 'white', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>
                  ✨ {s.skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Projection */}
        <h2 style={{ margin: `0 0 ${spacing.sm}`, color: 'white', borderBottom: `2px solid ${colors.primary[500]}`, paddingBottom: '0.5rem' }}>
          💡 Earnings Projection
        </h2>
        <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.lg, padding: spacing.lg }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: colors.neutral[400], textTransform: 'uppercase' }}>Annual Estimate</p>
            <p style={{ margin: '0.3rem 0 0', fontSize: '2.5rem', fontWeight: 800, color: colors.primary[500] }}>
              {formatUsd(projection?.annualEstimate ?? 0)}
            </p>
          </div>
          <div style={{ borderLeft: `1px solid rgba(255,255,255,0.1)`, paddingLeft: spacing.lg }}>
            <p style={{ margin: 0, color: 'white', fontSize: '0.9rem' }}>Monthly avg: <strong>{formatUsd(projection?.monthlyAverage ?? 0)}</strong></p>
            <p style={{ margin: '0.4rem 0', color: 'white', fontSize: '0.9rem' }}>Based on {projection?.basedOnMonths ?? 0} months</p>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: colors.neutral[400], fontStyle: 'italic' }}>
              ⚠️ {projection?.disclaimer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
