'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { retireCredits } from '../../lib/api';
import { formatTonnes } from '../../lib/carbon-utils';
import { connectFreighter } from '../../lib/freighter';
import { getWalletErrorMessage } from '../../lib/wallet-errors';
import { colors, spacing } from '../../styles/design-system';

export default function RetirePage() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batch') ?? '';

  const [amount, setAmount] = useState(1);
  const [beneficiary, setBeneficiary] = useState('');
  const [reason, setReason] = useState('');
  const [walletKey, setWalletKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retirementId, setRetirementId] = useState<string | null>(null);

  async function handleConnect() {
    try {
      const key = await connectFreighter();
      setWalletKey(key);
      setStatus('idle');
    } catch (e) {
      setErrorMsg(getWalletErrorMessage(e));
      setStatus('error');
    }
  }

  async function handleRetire() {
    if (!walletKey || !batchId || !beneficiary || !reason) return;
    setStatus('pending');
    try {
      const result = await retireCredits({
        batchId,
        projectId: 'PROJECT_ID', // Would be fetched from batch
        amount,
        beneficiary,
        retirementReason: reason,
        holderPublicKey: walletKey,
      });
      setRetirementId(result.retirementId);
      setStatus('success');
    } catch (e) {
      setErrorMsg(getWalletErrorMessage(e));
      setStatus('error');
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: spacing.xl }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: colors.neutral[900], marginBottom: spacing.lg }}>
        Retire Carbon Credits
      </h1>

      <div style={{ backgroundColor: 'white', padding: spacing.lg, borderRadius: '0.75rem', border: `1px solid ${colors.neutral[200]}` }}>
        <div style={{ marginBottom: spacing.lg }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: spacing.sm }}>
            Amount (tonnes)
          </label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{
              width: '100%',
              padding: spacing.sm,
              borderRadius: '0.375rem',
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: spacing.lg }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: spacing.sm }}>
            Beneficiary Name (e.g., "Google Inc", "UK Government")
          </label>
          <input
            type="text"
            placeholder="Organization or individual name"
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            style={{
              width: '100%',
              padding: spacing.sm,
              borderRadius: '0.375rem',
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: spacing.lg }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: spacing.sm }}>
            Retirement Reason
          </label>
          <textarea
            placeholder="Why are you retiring these credits? (e.g., 'Corporate carbon offset target 2024')"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: spacing.sm,
              borderRadius: '0.375rem',
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: '1rem',
              minHeight: '100px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div
          style={{
            marginBottom: spacing.lg,
            padding: spacing.lg,
            backgroundColor: colors.accent[50],
            borderRadius: '0.375rem',
            borderLeft: `4px solid ${colors.semantic.warning}`,
          }}
        >
          <p style={{ fontWeight: 700, margin: '0 0 0.5rem', color: colors.neutral[900] }}>
            ⚠️ Permanent Action
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem', color: colors.neutral[700] }}>
            Retiring {formatTonnes(amount)} is permanent and irreversible. This will generate a certificate proving the offset claim.
          </p>
        </div>

        {walletKey ? (
          <div>
            <p style={{ color: colors.neutral[600], fontSize: '0.875rem', marginBottom: spacing.md }}>
              Connected: {walletKey.slice(0, 8)}...
            </p>
            <button
              onClick={handleRetire}
              disabled={status === 'pending' || !beneficiary || !reason}
              style={{
                width: '100%',
                padding: spacing.md,
                backgroundColor:
                  status === 'pending' || !beneficiary || !reason ? colors.neutral[400] : colors.semantic.error,
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: status === 'pending' || !beneficiary || !reason ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'pending' ? 'Processing...' : 'Retire Credits (Irreversible)'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            style={{
              width: '100%',
              padding: spacing.md,
              backgroundColor: colors.primary[500],
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Connect Freighter Wallet
          </button>
        )}

        {status === 'success' && retirementId && (
          <div style={{ marginTop: spacing.lg, padding: spacing.lg, backgroundColor: '#dcfce7', borderRadius: '0.375rem', color: '#065f46' }}>
            <p style={{ fontWeight: 700, margin: '0 0 0.5rem' }}>✓ Retirement Successful!</p>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              Certificate ID: <code style={{ fontFamily: 'monospace' }}>{retirementId}</code>
            </p>
            <a href={`/retire/${retirementId}`} style={{ color: '#059669', fontWeight: 700, textDecoration: 'none' }}>
              View Certificate →
            </a>
          </div>
        )}

        {status === 'error' && errorMsg && (
          <div style={{ marginTop: spacing.lg, padding: spacing.md, backgroundColor: '#fee2e2', borderRadius: '0.375rem', color: '#991b1b' }}>
            ✕ {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
