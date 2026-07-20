'use client';

import { useState } from 'react';
import {
  usePortfolioDashboard,
  usePortfolioPipeline,
  usePortfolioMilestones,
  useSkillGrowth,
  useEarningsProjection,
  PIPELINE_STAGES,
  PipelineStage,
} from '../../lib/portfolio-api';
import { colors, spacing, shadows, borderRadius, glass } from '../../styles/design-system';

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

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ width = '100%', height = '1.5rem' }: { width?: string; height?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        backgroundColor: colors.neutral[200],
        borderRadius: borderRadius.sm,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = colors.primary[500],
  loading = false,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        ...glass,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        boxShadow: shadows.md,
        flex: '1 1 180px',
        minWidth: 160,
        borderLeft: `4px solid ${color}`,
      }}
    >
      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      {loading ? (
        <Skeleton height="2.5rem" />
      ) : (
        <p style={{ margin: '0.5rem 0 0', fontSize: '2rem', fontWeight: 800, color: colors.neutral[900] }}>
          {value}
        </p>
      )}
      {sub && !loading && (
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: colors.neutral[500] }}>{sub}</p>
      )}
    </div>
  );
}

// ── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({ contributorId }: { contributorId: string }) {
  const { data: pipeline, isLoading, error } = usePortfolioPipeline(contributorId);

  if (error) {
    return <p style={{ color: colors.semantic.error }}>Failed to load pipeline.</p>;
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: spacing.sm }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, minmax(200px, 1fr))`,
          gap: spacing.sm,
          minWidth: 1200,
        }}
        role="region"
        aria-label="Bounty pipeline kanban board"
      >
        {PIPELINE_STAGES.map((stage) => {
          const stageColor = STAGE_COLORS[stage];
          const items = pipeline?.[stage] ?? [];

          return (
            <div
              key={stage}
              style={{
                backgroundColor: stageColor.bg,
                border: `1px solid ${stageColor.border}`,
                borderRadius: borderRadius.lg,
                padding: spacing.sm,
                minHeight: 320,
              }}
            >
              {/* Column header */}
              <div style={{ marginBottom: spacing.sm }}>
                <p style={{ margin: 0, fontWeight: 700, color: stageColor.text, fontSize: '0.85rem' }}>
                  {STAGE_LABELS[stage]}
                </p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: colors.neutral[500] }}>
                  {isLoading ? '…' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Cards */}
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Skeleton height="5rem" />
                  <Skeleton height="5rem" />
                </div>
              ) : items.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2rem 1rem',
                    color: colors.neutral[500],
                    fontSize: '0.8rem',
                    border: `2px dashed ${stageColor.border}`,
                    borderRadius: borderRadius.md,
                  }}
                >
                  No bounties
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: borderRadius.md,
                        padding: '0.75rem',
                        boxShadow: shadows.sm,
                        border: `1px solid ${stageColor.border}`,
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: colors.neutral[900], lineHeight: 1.3 }}>
                        {item.bountyTitle}
                      </p>
                      <p style={{ margin: '0.4rem 0 0', fontWeight: 700, color: colors.primary[600], fontSize: '0.85rem' }}>
                        {formatUsd(item.rewardUsd)}
                      </p>
                      {item.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.4rem' }}>
                          {item.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              style={{
                                backgroundColor: colors.primary[100],
                                color: colors.primary[700],
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                padding: '0.1rem 0.4rem',
                                borderRadius: '9999px',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Milestone Timeline ───────────────────────────────────────────────────────

function MilestoneTimeline({ contributorId }: { contributorId: string }) {
  const { data: milestones, isLoading, error } = usePortfolioMilestones(contributorId);

  if (error) return <p style={{ color: colors.semantic.error }}>Failed to load milestones.</p>;
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[1, 2, 3].map((i) => <Skeleton key={i} height="3.5rem" />)}
      </div>
    );
  }
  if (!milestones?.length) {
    return <p style={{ color: colors.neutral[500] }}>No completed milestones yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} role="list" aria-label="Milestone timeline">
      {milestones.map((milestone) => (
        <div
          key={milestone.id}
          role="listitem"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: spacing.sm,
            padding: '0.75rem',
            backgroundColor: 'white',
            borderRadius: borderRadius.md,
            boxShadow: shadows.sm,
            border: `1px solid ${colors.neutral[200]}`,
          }}
        >
          {/* Timeline dot */}
          <div
            aria-hidden="true"
            style={{
              width: 12,
              height: 12,
              minWidth: 12,
              borderRadius: '50%',
              backgroundColor: colors.primary[500],
              marginTop: 4,
            }}
          />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, color: colors.neutral[900], fontSize: '0.9rem' }}>
              {milestone.bountyTitle}
            </p>
            <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', marginTop: '0.3rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: colors.primary[600], fontSize: '0.9rem' }}>
                {formatUsd(milestone.earningsUsd)}
              </span>
              <span style={{ fontSize: '0.75rem', color: colors.neutral[500] }}>
                {formatDate(milestone.completedAt)}
              </span>
            </div>
            {milestone.skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.35rem' }}>
                {milestone.skills.map((skill) => (
                  <span
                    key={skill}
                    style={{
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.5rem',
                      borderRadius: '9999px',
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Skill Growth ─────────────────────────────────────────────────────────────

function SkillGrowthChart({ contributorId }: { contributorId: string }) {
  const { data: skills, isLoading, error } = useSkillGrowth(contributorId);

  if (error) return <p style={{ color: colors.semantic.error }}>Failed to load skill growth.</p>;
  if (isLoading) return <Skeleton height="4rem" />;

  return (
    <div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: colors.neutral[500] }}>
        {skills?.length ?? 0} skill{skills?.length !== 1 ? 's' : ''} acquired in the last 90 days
      </p>
      {!skills?.length ? (
        <p style={{ color: colors.neutral[500] }}>No new skills in the last 90 days.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }} role="list" aria-label="Recently acquired skills">
          {skills.map((s) => (
            <div
              key={s.skill + s.acquiredAt}
              role="listitem"
              style={{
                backgroundColor: colors.primary[100],
                color: colors.primary[700],
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '0.4rem 0.9rem',
                borderRadius: '9999px',
                border: `1px solid ${colors.primary[500]}`,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>✨</span>
              {s.skill}
              <span style={{ fontSize: '0.7rem', color: colors.primary[600], fontWeight: 400 }}>
                {formatDate(s.acquiredAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Earnings Projection ──────────────────────────────────────────────────────

function EarningsProjection({ contributorId }: { contributorId: string }) {
  const { data: projection, isLoading, error } = useEarningsProjection(contributorId);

  if (error) return <p style={{ color: colors.semantic.error }}>Failed to load projection.</p>;

  return (
    <div
      style={{
        display: 'flex',
        gap: spacing.lg,
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          backgroundColor: colors.neutral[900],
          color: 'white',
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          minWidth: 200,
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Annual Estimate
        </p>
        {isLoading ? (
          <Skeleton height="3rem" />
        ) : (
          <p style={{ margin: '0.5rem 0 0', fontSize: '2.5rem', fontWeight: 800, color: colors.primary[500] }}>
            {formatUsd(projection?.annualEstimate ?? 0)}
          </p>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 200 }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Skeleton height="1rem" />
            <Skeleton height="1rem" />
            <Skeleton height="1rem" />
          </div>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: '0.9rem', color: colors.neutral[700] }}>
              <strong>Monthly average:</strong> {formatUsd(projection?.monthlyAverage ?? 0)}
            </p>
            <p style={{ margin: '0.4rem 0', fontSize: '0.9rem', color: colors.neutral[700] }}>
              <strong>Based on:</strong> {projection?.basedOnMonths ?? 0} month{projection?.basedOnMonths !== 1 ? 's' : ''} of data
            </p>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', color: colors.neutral[500], fontStyle: 'italic' }}>
              ⚠️ {projection?.disclaimer}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── PDF Export ────────────────────────────────────────────────────────────────

async function exportPortfolioPdf(contributorId: string, dashboardData: {
  activeBounties: number;
  completedBounties: number;
  totalEarnings: number;
  rating: number;
}) {
  // Dynamically import jsPDF to avoid SSR issues
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Title
  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129); // emerald
  doc.text('CarbonLedger Contributor Portfolio', margin, y);

  y += 10;
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Contributor: ${contributorId}`, margin, y);

  y += 6;
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);

  // Divider
  y += 8;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // Stats section
  y += 12;
  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text('Portfolio Summary', margin, y);

  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(55, 65, 81);

  const stats = [
    ['Active Bounties', String(dashboardData.activeBounties)],
    ['Completed Bounties', String(dashboardData.completedBounties)],
    ['Total Earnings', formatUsd(dashboardData.totalEarnings)],
    ['Rating', `${dashboardData.rating}/5`],
  ];

  stats.forEach(([label, value]) => {
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(label, margin, y);
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text(value, margin + 60, y);
    y += 8;
  });

  // Pipeline section
  y += 6;
  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.text('Pipeline Overview', margin, y);

  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text('Applied → Claimed → In Progress → Submitted → Under Review → Completed', margin, y, {
    maxWidth: pageWidth - margin * 2,
  });

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text('Generated by CarbonLedger · Built on Stellar', margin, pageHeight - 10);

  doc.save(`portfolio-${contributorId}-${Date.now()}.pdf`);
}

// ── Section Wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: spacing.xl }}>
      <h2 style={{
        margin: `0 0 ${spacing.sm}`,
        fontSize: '1.25rem',
        fontWeight: 700,
        color: colors.neutral[900],
        borderBottom: `2px solid ${colors.primary[500]}`,
        paddingBottom: '0.5rem',
      }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PortfolioDashboard() {
  const [contributorId, setContributorId] = useState('demo-contributor');
  const [inputId, setInputId] = useState('demo-contributor');
  const [exporting, setExporting] = useState(false);

  const { data: dashboard, isLoading: dashLoading } = usePortfolioDashboard(contributorId);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputId.trim()) setContributorId(inputId.trim());
  };

  const handleExport = async () => {
    if (!dashboard) return;
    setExporting(true);
    try {
      await exportPortfolioPdf(contributorId, dashboard);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {/* Page header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
          borderBottom: `2px solid ${colors.primary[500]}`,
          padding: `${spacing.xl} ${spacing.lg}`,
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'white' }}>
            📁 Contributor Portfolio
          </h1>
          <p style={{ margin: '0.5rem 0 0', color: '#6ee7b7', fontSize: '1rem' }}>
            Track your active bounties, earnings, and skill growth
          </p>

          {/* Contributor selector */}
          <form
            onSubmit={handleSearch}
            style={{ display: 'flex', gap: '0.75rem', marginTop: spacing.md, flexWrap: 'wrap' }}
          >
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              placeholder="Enter contributor ID (e.g. demo-contributor)"
              aria-label="Contributor ID"
              style={{
                flex: '1 1 260px',
                padding: '0.6rem 1rem',
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.primary[500]}`,
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '0.6rem 1.5rem',
                backgroundColor: colors.primary[500],
                color: 'white',
                border: 'none',
                borderRadius: borderRadius.md,
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              Load Portfolio
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !dashboard}
              aria-label="Export portfolio as PDF"
              style={{
                padding: '0.6rem 1.5rem',
                backgroundColor: exporting ? colors.neutral[500] : '#0891b2',
                color: 'white',
                border: 'none',
                borderRadius: borderRadius.md,
                fontWeight: 600,
                cursor: exporting || !dashboard ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
              }}
            >
              {exporting ? 'Exporting…' : '📄 Export PDF'}
            </button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: `${spacing.xl} ${spacing.lg}` }}>
        {/* Stats row */}
        <Section title="Portfolio Overview">
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
            <StatCard
              label="Active Bounties"
              value={dashLoading ? '…' : String(dashboard?.activeBounties ?? 0)}
              color={colors.semantic.info}
              loading={dashLoading}
            />
            <StatCard
              label="Completed"
              value={dashLoading ? '…' : String(dashboard?.completedBounties ?? 0)}
              color={colors.primary[500]}
              loading={dashLoading}
            />
            <StatCard
              label="Total Earnings"
              value={dashLoading ? '…' : formatUsd(dashboard?.totalEarnings ?? 0)}
              color={colors.semantic.success}
              loading={dashLoading}
            />
            <StatCard
              label="Rating"
              value={dashLoading ? '…' : `${dashboard?.rating ?? 0}/5`}
              sub="⭐ Contributor rating"
              color={colors.semantic.warning}
              loading={dashLoading}
            />
          </div>
        </Section>

        {/* Kanban pipeline */}
        <Section title="🗂️ Pipeline Board">
          <KanbanBoard contributorId={contributorId} />
        </Section>

        {/* Two-column layout for milestones and skills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: spacing.lg }}>
          <Section title="🏆 Milestone Timeline">
            <MilestoneTimeline contributorId={contributorId} />
          </Section>

          <Section title="📈 Skill Growth (Last 90 Days)">
            <SkillGrowthChart contributorId={contributorId} />
          </Section>
        </div>

        {/* Earnings projection */}
        <Section title="💡 Earnings Projection">
          <EarningsProjection contributorId={contributorId} />
        </Section>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
