'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useContributorProfile,
  useRecommendations,
  useLearningPaths,
  useSkillTaxonomy,
  BountyMatchResult,
  LearningPath,
} from '../../lib/matching-api';
import { colors, spacing, shadows, borderRadius } from '../../styles/design-system';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEMO_CONTRIBUTORS = [
  { id: 'alice-dev', label: 'Alice (Smart Contracts)' },
  { id: 'bob-frontend', label: 'Bob (Frontend)' },
  { id: 'carol-fullstack', label: 'Carol (Full-Stack)' },
  { id: 'dave-devops', label: 'Dave (DevOps)' },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'smart-contracts': { bg: '#fef3c7', text: '#92400e' },
  frontend: { bg: '#dbeafe', text: '#1e40af' },
  backend: { bg: '#f0fdf4', text: '#166534' },
  devops: { bg: '#fae8ff', text: '#6b21a8' },
  testing: { bg: '#fff7ed', text: '#9a3412' },
  documentation: { bg: '#f0f9ff', text: '#0369a1' },
  security: { bg: '#fef2f2', text: '#991b1b' },
};

const EXPERIENCE_COLORS: Record<string, string> = {
  junior: '#3b82f6',
  mid: '#10b981',
  senior: '#f59e0b',
  expert: '#ef4444',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function scoreColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 30) return '#f59e0b';
  return '#ef4444';
}

function scoreBg(score: number): string {
  if (score >= 70) return '#d1fae5';
  if (score >= 30) return '#fef9c3';
  return '#fee2e2';
}

function Skeleton({ width = '100%', height = '1rem' }: { width?: string; height?: string }) {
  return (
    <div style={{ width, height, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.sm }} aria-hidden="true" />
  );
}

// ── Score Badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      aria-label={`Match score: ${score}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
        borderRadius: '50%',
        backgroundColor: scoreBg(score),
        border: `3px solid ${scoreColor(score)}`,
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 800, fontSize: '1rem', color: scoreColor(score) }}>{score}</span>
    </div>
  );
}

// ── Bounty Match Card ─────────────────────────────────────────────────────────

function MatchCard({ result }: { result: BountyMatchResult }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.07)',
        border: `1px solid rgba(255,255,255,0.12)`,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        alignItems: 'flex-start',
      }}
      role="article"
      aria-label={`${result.title}: ${result.matchScore}% match`}
    >
      <ScoreBadge score={result.matchScore} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            href={`/bounties/${result.bountyId}`}
            style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem', textDecoration: 'none', flex: 1 }}
          >
            {result.title}
          </Link>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            {result.isLearningBounty && (
              <span style={{
                backgroundColor: '#f59e0b20',
                color: '#f59e0b',
                border: '1px solid #f59e0b',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: '9999px',
              }}>
                📚 LEARNING
              </span>
            )}
            {!result.availability && (
              <span style={{ backgroundColor: '#ef444420', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '9999px' }}>
                CLOSED
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: spacing.sm, marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: colors.primary[500] }}>{formatUsd(result.rewardUsd)}</span>
          <span style={{ fontSize: '0.8rem', color: colors.neutral[400] }}>·</span>
          <span style={{ fontSize: '0.8rem', color: colors.neutral[400], textTransform: 'capitalize' }}>{result.difficulty}</span>
        </div>

        {/* Matched skills */}
        {result.matchedSkills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
            {result.matchedSkills.map((skill) => (
              <span key={skill} style={{ backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                ✓ {skill}
              </span>
            ))}
          </div>
        )}

        {/* Missing skills */}
        {result.missingSkills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
            {result.missingSkills.map((skill) => (
              <span key={skill} style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>
                ✗ {skill}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Learning Paths ────────────────────────────────────────────────────────────

function LearningPathsSection({ paths }: { paths: LearningPath[] }) {
  if (!paths.length) {
    return (
      <p style={{ color: colors.neutral[400], fontStyle: 'italic' }}>
        No learning paths found. You may already have the required skills for available bounties.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
      {paths.map((path) => (
        <div
          key={path.targetSkill}
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: borderRadius.lg,
            padding: spacing.md,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: spacing.sm }}>
            <span style={{ fontSize: '1.2rem' }}>📚</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: 'white' }}>Learn: {path.targetSkill}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#fbbf24' }}>
                ~{path.estimatedHours}h estimated · {path.relatedBounties.length} bounty opportunity{path.relatedBounties.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {path.relatedBounties.slice(0, 3).map((b) => (
              <div key={b.bountyId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: borderRadius.sm, padding: '0.5rem 0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link href={`/bounties/${b.bountyId}`} style={{ color: '#6ee7b7', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', flex: 1 }}>
                  {b.title}
                </Link>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ color: colors.primary[500], fontWeight: 700, fontSize: '0.85rem' }}>{formatUsd(b.rewardUsd)}</span>
                  <span style={{ backgroundColor: scoreBg(b.matchScore), color: scoreColor(b.matchScore), fontWeight: 700, fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>
                    {b.matchScore}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Skill Taxonomy Accordion ─────────────────────────────────────────────────

function TaxonomySection() {
  const [open, setOpen] = useState<string | null>(null);
  const { data: taxonomy, isLoading } = useSkillTaxonomy();

  if (isLoading) return <Skeleton height="3rem" />;
  if (!taxonomy) return null;

  return (
    <div>
      <p style={{ margin: '0 0 0.75rem', color: colors.neutral[400], fontSize: '0.85rem' }}>
        {taxonomy.totalSkills} skills across {Object.keys(taxonomy.categories).length} categories
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {Object.entries(taxonomy.categories).map(([category, skills]) => {
          const catColor = CATEGORY_COLORS[category] ?? { bg: '#f3f4f6', text: '#374151' };
          const isOpen = open === category;
          return (
            <div
              key={category}
              style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: borderRadius.md, overflow: 'hidden' }}
            >
              <button
                onClick={() => setOpen(isOpen ? null : category)}
                aria-expanded={isOpen}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  textAlign: 'left',
                }}
              >
                <span style={{ textTransform: 'capitalize' }}>{category.replace('-', ' ')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: colors.neutral[400] }}>{skills.length} skills</span>
                  <span style={{ fontSize: '0.8rem', color: colors.primary[500] }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {skills.map((skill: string) => (
                      <span
                        key={skill}
                        style={{
                          backgroundColor: catColor.bg,
                          color: catColor.text,
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          padding: '0.25rem 0.6rem',
                          borderRadius: '9999px',
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Contributor Profile Card ──────────────────────────────────────────────────

function ProfileCard({ contributorId }: { contributorId: string }) {
  const { data: profile, isLoading, error } = useContributorProfile(contributorId);

  if (error) return null;

  return (
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.07)',
      border: `1px solid rgba(255,255,255,0.15)`,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    }}>
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Skeleton height="1.5rem" width="40%" />
          <Skeleton height="1rem" />
        </div>
      ) : profile ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>{profile.contributorId}</h3>
            <span style={{
              backgroundColor: EXPERIENCE_COLORS[profile.experienceLevel] + '22',
              color: EXPERIENCE_COLORS[profile.experienceLevel],
              border: `1px solid ${EXPERIENCE_COLORS[profile.experienceLevel]}`,
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              textTransform: 'capitalize',
            }}>
              {profile.experienceLevel}
            </span>
          </div>

          {/* Success rate bar */}
          <div style={{ marginBottom: spacing.sm }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.8rem', color: colors.neutral[400] }}>Success Rate</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: colors.primary[500] }}>
                {Math.round(profile.successRate * 100)}%
              </span>
            </div>
            <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${profile.successRate * 100}%`, backgroundColor: colors.primary[500], borderRadius: 9999 }} />
            </div>
          </div>

          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: colors.neutral[400] }}>
            {profile.pastCompletions} bounties completed
          </p>

          {/* Skills by category */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {profile.skills.map((skill) => {
              const catColor = CATEGORY_COLORS['frontend']; // default
              return (
                <span
                  key={skill}
                  style={{ backgroundColor: '#064e3b', color: '#6ee7b7', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '9999px', border: '1px solid #065f46' }}
                >
                  {skill}
                </span>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MatchingPage() {
  const [selectedId, setSelectedId] = useState('alice-dev');

  const { data: recData, isLoading: recLoading, error: recError } = useRecommendations(selectedId, 15);
  const { data: learningPaths, isLoading: lpLoading } = useLearningPaths(selectedId);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
        borderBottom: `2px solid ${colors.primary[500]}`,
        padding: `${spacing.xl} ${spacing.lg}`,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'white' }}>
            🎯 Skill Matching Engine
          </h1>
          <p style={{ margin: '0.5rem 0 0', color: '#a5b4fc', fontSize: '1rem' }}>
            Ranked bounty recommendations based on your skills and experience
          </p>

          {/* Contributor selector */}
          <div style={{ marginTop: spacing.md, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {DEMO_CONTRIBUTORS.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                aria-pressed={selectedId === c.id}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: selectedId === c.id ? colors.primary[500] : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: selectedId === c.id ? `2px solid ${colors.primary[500]}` : '2px solid rgba(255,255,255,0.2)',
                  borderRadius: borderRadius.md,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'all 150ms ease',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: `${spacing.xl} ${spacing.lg}` }}>
        {/* Profile card */}
        <ProfileCard contributorId={selectedId} />

        {/* Performance indicator */}
        {recData && (
          <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.75rem', color: colors.neutral[500], backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.75rem', borderRadius: '9999px' }}>
              ⚡ Computed in {recData.computedInMs}ms
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: spacing.xl }}>
          {/* Recommendations */}
          <div>
            <h2 style={{ margin: `0 0 ${spacing.sm}`, color: 'white', borderBottom: `2px solid ${colors.primary[500]}`, paddingBottom: '0.5rem' }}>
              🏆 Recommended Bounties
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: colors.neutral[400] }}>
              Ranked by match score · 🟢 ≥70% match · 🟡 30–70% (learning) · 🔴 &lt;30%
            </p>

            {recError ? (
              <p style={{ color: colors.semantic.error }}>Failed to load recommendations. Make sure the backend is running.</p>
            ) : recLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[1,2,3,4].map(i => <Skeleton key={i} height="6rem" />)}
              </div>
            ) : !recData?.recommendations.length ? (
              <p style={{ color: colors.neutral[400] }}>No recommendations found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recData.recommendations.map((result) => (
                  <MatchCard key={result.bountyId} result={result} />
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <div>
            {/* Learning paths */}
            <h2 style={{ margin: `0 0 ${spacing.sm}`, color: 'white', borderBottom: `2px solid #f59e0b`, paddingBottom: '0.5rem' }}>
              📚 Learning Paths
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: colors.neutral[400] }}>
              Stretch bounties (30–70% match) grouped by skill you could learn
            </p>
            {lpLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[1,2,3].map(i => <Skeleton key={i} height="5rem" />)}
              </div>
            ) : (
              <LearningPathsSection paths={learningPaths ?? []} />
            )}

            {/* Skill taxonomy */}
            <h2 style={{ margin: `${spacing.xl} 0 ${spacing.sm}`, color: 'white', borderBottom: `2px solid #818cf8`, paddingBottom: '0.5rem' }}>
              🗂️ Skill Taxonomy Explorer
            </h2>
            <TaxonomySection />
          </div>
        </div>
      </div>
    </div>
  );
}
