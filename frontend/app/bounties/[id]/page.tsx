'use client';

import { use } from 'react';
import Link from 'next/link';
import { useBounty, Difficulty } from '../../../lib/api';
import { colors, spacing, shadows, borderRadius } from '../../../styles/design-system';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<Difficulty, { bg: string; text: string }> = {
  beginner:     { bg: '#dcfce7', text: '#166534' },
  intermediate: { bg: '#fef9c3', text: '#854d0e' },
  advanced:     { bg: '#ffedd5', text: '#9a3412' },
  expert:       { bg: '#fee2e2', text: '#991b1b' },
};

function daysUntil(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        border: `1px solid ${colors.neutral[200]}`,
        boxShadow: shadows.sm,
      }}
    >
      <h2
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: colors.neutral[900],
          marginBottom: spacing.sm,
          marginTop: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
      {items.map((item, i) => (
        <li key={i} style={{ color: colors.neutral[700], fontSize: '0.9rem', marginBottom: '0.375rem', lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: bounty, isLoading, error } = useBounty(id);

  if (isLoading) {
    return (
      <main
        style={{ maxWidth: '860px', margin: '0 auto', padding: `${spacing.xl} ${spacing.lg}` }}
        aria-busy="true"
        aria-label="Loading bounty details"
      >
        {[1, 2, 3].map(k => (
          <div
            key={k}
            style={{
              backgroundColor: colors.neutral[100],
              borderRadius: borderRadius.lg,
              height: k === 1 ? '180px' : '120px',
              marginBottom: spacing.md,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
        ))}
      </main>
    );
  }

  if (error || !bounty) {
    return (
      <main
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: `${spacing.xl} ${spacing.lg}`,
          textAlign: 'center',
        }}
        role="alert"
      >
        <h1 style={{ color: colors.neutral[900] }}>Bounty not found</h1>
        <p style={{ color: colors.neutral[500] }}>
          This bounty may have been removed or is internal.
        </p>
        <Link
          href="/bounties"
          style={{
            color: colors.primary[600],
            fontWeight: 600,
            textDecoration: 'underline',
          }}
        >
          ← Back to marketplace
        </Link>
      </main>
    );
  }

  const diffColor = DIFFICULTY_COLORS[bounty.difficulty];
  const days = daysUntil(bounty.deadline);
  const deadlineColor = days <= 3 ? colors.semantic.error : days <= 7 ? colors.semantic.warning : colors.neutral[700];

  return (
    <main style={{ maxWidth: '860px', margin: '0 auto', padding: `${spacing.xl} ${spacing.lg}` }}>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: spacing.md }}>
        <Link
          href="/bounties"
          style={{ color: colors.primary[600], fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}
        >
          ← Bounty Marketplace
        </Link>
      </nav>

      {/* Hero card */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          border: bounty.featured
            ? `2px solid ${colors.primary[500]}`
            : `1px solid ${colors.neutral[200]}`,
          boxShadow: shadows.md,
          marginBottom: spacing.lg,
        }}
      >
        {/* Type + featured badge */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center', marginBottom: spacing.xs }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: colors.neutral[500],
            }}
          >
            {bounty.bountyType}
          </span>
          {bounty.featured && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: colors.primary[100],
                color: colors.primary[700],
                padding: '2px 10px',
                borderRadius: '999px',
              }}
            >
              ⭐ Featured
            </span>
          )}
        </div>

        <h1
          style={{
            fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
            fontWeight: 800,
            color: colors.neutral[900],
            margin: `0 0 ${spacing.sm}`,
          }}
        >
          {bounty.title}
        </h1>

        {/* Key stats row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing.md,
            alignItems: 'center',
            paddingTop: spacing.sm,
            borderTop: `1px solid ${colors.neutral[100]}`,
          }}
        >
          {/* Reward */}
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', color: colors.neutral[500], textTransform: 'uppercase', fontWeight: 700 }}>Reward</p>
            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: colors.primary[600] }}>
              ${bounty.rewardUsd.toLocaleString()}
            </p>
          </div>

          {/* Difficulty */}
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', color: colors.neutral[500], textTransform: 'uppercase', fontWeight: 700 }}>Difficulty</p>
            <span
              style={{
                display: 'inline-block',
                marginTop: '4px',
                fontSize: '0.875rem',
                fontWeight: 600,
                backgroundColor: diffColor.bg,
                color: diffColor.text,
                padding: '3px 12px',
                borderRadius: '999px',
              }}
            >
              {bounty.difficulty}
            </span>
          </div>

          {/* Deadline */}
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', color: colors.neutral[500], textTransform: 'uppercase', fontWeight: 700 }}>Deadline</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem', fontWeight: 600, color: deadlineColor }}>
              {new Date(bounty.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              {' '}
              ({days > 0 ? `${days}d left` : 'Expired'})
            </p>
          </div>

          {/* Applications */}
          <div>
            <p style={{ margin: 0, fontSize: '0.7rem', color: colors.neutral[500], textTransform: 'uppercase', fontWeight: 700 }}>Applicants</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem', fontWeight: 600, color: colors.neutral[700] }}>
              {bounty.applicationCount}
            </p>
          </div>
        </div>
      </div>

      {/* Body — 2-column on wide screens */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: spacing.lg,
          alignItems: 'start',
        }}
      >
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>

          <SectionCard title="Description">
            <p style={{ margin: 0, color: colors.neutral[700], lineHeight: 1.7, fontSize: '0.9rem' }}>
              {bounty.description}
            </p>
          </SectionCard>

          <SectionCard title="Requirements">
            <BulletList items={bounty.requirements} />
          </SectionCard>

          <SectionCard title="Acceptance Criteria">
            <BulletList items={bounty.acceptanceCriteria} />
          </SectionCard>

          {/* Tags */}
          {bounty.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {bounty.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/bounties?tag=${encodeURIComponent(tag)}`}
                  style={{
                    fontSize: '0.75rem',
                    backgroundColor: colors.neutral[100],
                    color: colors.neutral[700],
                    padding: '4px 10px',
                    borderRadius: '999px',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>

          {/* Apply CTA */}
          <div
            style={{
              backgroundColor: colors.primary[50],
              borderRadius: borderRadius.lg,
              padding: spacing.lg,
              border: `1px solid ${colors.primary[100]}`,
              boxShadow: shadows.sm,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: `0 0 ${spacing.xs}`, fontWeight: 700, color: colors.primary[700], fontSize: '1.05rem' }}>
              Ready to build?
            </p>
            <p style={{ margin: `0 0 ${spacing.md}`, color: colors.neutral[500], fontSize: '0.875rem' }}>
              Connect your wallet to submit an application.
            </p>
            <a
              href="/dashboard"
              style={{
                display: 'inline-block',
                padding: '0.75rem 2rem',
                backgroundColor: colors.primary[500],
                color: 'white',
                borderRadius: borderRadius.md,
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: '0.9rem',
              }}
            >
              Apply Now
            </a>
          </div>

          {/* Reviewer profile */}
          <SectionCard title="Reviewer">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: colors.neutral[500], textTransform: 'uppercase', fontWeight: 700 }}>
                  Stellar Address
                </p>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.8rem',
                    fontFamily: '"Courier New", monospace',
                    color: colors.neutral[700],
                    wordBreak: 'break-all',
                  }}
                >
                  {bounty.reviewerAddress}
                </p>
              </div>
              {bounty.reviewerGithub && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: colors.neutral[500], textTransform: 'uppercase', fontWeight: 700 }}>
                    GitHub
                  </p>
                  <a
                    href={`https://github.com/${bounty.reviewerGithub}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: colors.primary[600], fontWeight: 600, fontSize: '0.875rem' }}
                  >
                    @{bounty.reviewerGithub}
                  </a>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Timeline */}
          <SectionCard title="Timeline">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: colors.neutral[500] }}>Posted</span>
                <span style={{ color: colors.neutral[700], fontWeight: 600 }}>
                  {new Date(bounty.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: colors.neutral[500] }}>Deadline</span>
                <span style={{ color: deadlineColor, fontWeight: 600 }}>
                  {new Date(bounty.deadline).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: colors.neutral[500] }}>Status</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: bounty.status === 'open' ? colors.semantic.success : colors.neutral[500],
                  }}
                >
                  {bounty.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </SectionCard>

        </div>
      </div>
    </main>
  );
}
