'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useListing, purchaseCredits } from '../../lib/api';
import { formatTonnes, stroopsToUSDC, calculateCreditCost, displayCreditCost } from '../../lib/carbon-utils';
import { connectFreighter } from '../../lib/freighter';
import { getWalletErrorMessage } from '../../lib/wallet-errors';
import { colors, spacing } from '../../styles/design-system';

export default function BuyPage() {
  const searchParams = useSearchParams();
  const listingId = searchParams.get('listing') ?? '';

  const { data: listing } = useListing(listingId);
  const [amount, setAmount] = useState(1);
  const [walletKey, setWalletKey] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalCost = listing ? calculateCreditCost(amount, BigInt(listing.pricePerCredit)) : 0n;

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

  async function handlePurchase() {
    if (!walletKey || !listing) return;
    setStatus('pending');
    try {
      const result = await purchaseCredits(listingId, amount, walletKey);
      setStatus('success');
      setTimeout(() => {
        window.location.href = `/retire?batch=${result.batchId}`;
      }, 2000);
    } catch (e) {
      setErrorMsg(getWalletErrorMessage(e));
      setStatus('error');
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: spacing.xl }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: colors.neutral[900], marginBottom: spacing.lg }}>
        Purchase Carbon Credits
      </h1>

      {listing ? (
        <div style={{ backgroundColor: 'white', padding: spacing.lg, borderRadius: '0.75rem', border: `1px solid ${colors.neutral[200]}` }}>
          <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>{listing.methodology}</h2>
          <p style={{ color: colors.neutral[600], margin: '0.5rem 0' }}>
            Available: {formatTonnes(listing.amountAvailable)}
          </p>
          <p style={{ color: colors.neutral[600], margin: '0.5rem 0' }}>
            Vintage: {listing.vintageYear} • {listing.country}
          </p>

          <div style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTop: `1px solid ${colors.neutral[200]}` }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: spacing.sm }}>
              Amount (tonnes)
            </label>
            <input
              type="number"
              min="1"
              max={listing.amountAvailable}
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

          <div style={{ marginTop: spacing.lg, padding: spacing.lg, backgroundColor: colors.primary[50], borderRadius: '0.375rem' }}>
            <p style={{ color: colors.neutral[600], margin: '0 0 0.5rem' }}>
              Price per tonne: ${stroopsToUSDC(BigInt(listing.pricePerCredit)).toFixed(2)}
            </p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: colors.primary[600], margin: 0 }}>
              Total: {displayCreditCost(totalCost)}
            </p>
          </div>

          {walletKey ? (
            <div style={{ marginTop: spacing.lg }}>
              <p style={{ color: colors.neutral[600], fontSize: '0.875rem' }}>
                Connected: {walletKey.slice(0, 8)}...
              </p>
              <button
                onClick={handlePurchase}
                disabled={status === 'pending'}
                style={{
                  width: '100%',
                  padding: spacing.md,
                  backgroundColor: status === 'pending' ? colors.neutral[400] : colors.primary[500],
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: status === 'pending' ? 'not-allowed' : 'pointer',
                }}
              >
                {status === 'pending' ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              style={{
                width: '100%',
                marginTop: spacing.lg,
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

          {status === 'success' && (
            <div style={{ marginTop: spacing.lg, padding: spacing.md, backgroundColor: '#dcfce7', borderRadius: '0.375rem', color: '#065f46' }}>
              ✓ Purchase successful! Redirecting to retirement...
            </div>
          )}

          {status === 'error' && errorMsg && (
            <div style={{ marginTop: spacing.lg, padding: spacing.md, backgroundColor: '#fee2e2', borderRadius: '0.375rem', color: '#991b1b' }}>
              ✕ {errorMsg}
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.neutral[600] }}>
          Loading listing...
        </div>
      )}
    </div>
  );
}
