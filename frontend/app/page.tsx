'use client';

import { usePlatformStats, useRetirements } from '../lib/api';
import { formatTonnes } from '../lib/carbon-utils';
import { colors, spacing } from '../styles/design-system';

export default function HomePage() {
  const { data: stats } = usePlatformStats();
  const { data: retirements } = useRetirements();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: spacing.xl }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, color: colors.primary[700], margin: '0 0 1rem' }}>
          Tokenize. Trade. Retire.
        </h1>
        <p style={{ fontSize: '1.25rem', color: colors.neutral[600], margin: 0 }}>
          Verified carbon credits with absolute provenance on Stellar.
        </p>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing.lg, marginBottom: spacing.xl }}>
          <StatCard label="Total Projects" value={stats.totalProjects} />
          <StatCard label="Verified Projects" value={stats.verifiedProjects} />
          <StatCard label="Credits Issued" value={formatTonnes(stats.totalCreditsIssued)} />
          <StatCard label="Credits Retired" value={formatTonnes(stats.totalCreditsRetired)} />
          <StatCard label="Retirement Rate" value={`${stats.retirementRate}%`} />
          <StatCard label="Active Listings" value={stats.activeListings} />
        </div>
      )}

      {/* Recent Retirements */}
      <div style={{ backgroundColor: colors.neutral[100], padding: spacing.lg, borderRadius: '0.75rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 0 }}>Recent Retirements</h2>
        {retirements && retirements.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {retirements.slice(0, 5).map((r) => (
              <li
                key={r.id}
                style={{
                  padding: spacing.md,
                  borderBottom: `1px solid ${colors.neutral[200]}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{r.beneficiary}</strong> retired {r.amount} tonne{r.amount !== 1 ? 's' : ''}
                  <br />
                  <small style={{ color: colors.neutral[600] }}>
                    {new Date(r.retiredAt).toLocaleDateString()} — {r.retirementReason}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: colors.neutral[600] }}>No retirements yet.</p>
        )}
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', marginTop: spacing.xl }}>
        <a
          href="/marketplace"
          style={{
            display: 'inline-block',
            padding: `${spacing.md} ${spacing.xl}`,
            backgroundColor: colors.primary[500],
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.5rem',
            fontWeight: 700,
            fontSize: '1.1rem',
          }}
        >
          Browse Marketplace
        </a>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        backgroundColor: 'white',
        padding: spacing.lg,
        borderRadius: '0.75rem',
        border: `1px solid ${colors.neutral[200]}`,
        textAlign: 'center',
      }}
    >
      <p style={{ color: colors.neutral[600], margin: '0 0 0.5rem', fontSize: '0.875rem' }}>{label}</p>
      <p style={{ fontSize: '2rem', fontWeight: 800, color: colors.primary[600], margin: 0 }}>{value}</p>
    </div>
  );
}
