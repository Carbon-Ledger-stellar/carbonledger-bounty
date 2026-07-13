export function getWalletErrorMessage(error: any): string {
  if (!error) return 'Unknown wallet error';

  const message = typeof error === 'string' ? error : error.message || String(error);

  const errorMap: Record<string, string> = {
    WALLET_NOT_INSTALLED: 'Freighter wallet not installed. Please install it from freighter.app',
    WALLET_PERMISSION_DENIED: 'Permission denied. Please allow CarbonLedger in Freighter.',
    INVALID_SIGNATURE: 'Invalid wallet signature. Please try again.',
    NETWORK_MISMATCH: 'Network mismatch. Please switch to Stellar testnet in Freighter.',
    INSUFFICIENT_BALANCE: 'Insufficient USDC balance. Please fund your wallet.',
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (message.includes(key)) return value;
  }

  return message.slice(0, 100);
}
