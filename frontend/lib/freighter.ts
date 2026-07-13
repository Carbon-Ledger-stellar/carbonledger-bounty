import {
  getPublicKey as freighterGetPublicKey,
  signTransaction as freighterSignTransaction,
  isConnected,
  isAllowed,
  setAllowed,
  getNetworkDetails,
} from '@stellar/freighter-api';

export type FreighterNetwork = 'TESTNET' | 'PUBLIC' | 'FUTURENET';

export async function connectFreighter(): Promise<string> {
  const connected = await isConnected();
  if (!connected.isConnected) {
    throw new Error('WALLET_NOT_INSTALLED');
  }

  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    const result = await setAllowed();
    if (!result.isAllowed) throw new Error('WALLET_PERMISSION_DENIED');
  }

  return getPublicKey();
}

export async function getPublicKey(): Promise<string> {
  const result = await freighterGetPublicKey();
  if (result.error) throw new Error(result.error);
  return result.publicKey;
}

export async function signTransaction(
  xdr: string,
  network: FreighterNetwork = 'TESTNET',
): Promise<string> {
  const result = await freighterSignTransaction(xdr, { network });
  if (result.error) throw new Error(result.error);
  return result.signedTxXdr;
}

export async function checkNetwork(): Promise<FreighterNetwork> {
  const details = await getNetworkDetails();
  if (details.error) throw new Error(details.error);
  
  const passphrase = details.networkPassphrase || '';
  if (passphrase.includes('Test SDF')) return 'TESTNET';
  if (passphrase.includes('Public Global')) return 'PUBLIC';
  return 'FUTURENET';
}
