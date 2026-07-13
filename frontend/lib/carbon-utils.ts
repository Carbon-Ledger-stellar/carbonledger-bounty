/**
 * Carbon credit utility functions
 */

const STROOPS_PER_USDC = 10_000_000;

export function formatStroops(stroops: bigint | number): string {
  const usdc = Number(stroops) / STROOPS_PER_USDC;
  return usdc.toFixed(2);
}

export function stroopsToUSDC(stroops: bigint | number): number {
  return Number(stroops) / STROOPS_PER_USDC;
}

export function usdcToStroops(usdc: number): bigint {
  return BigInt(Math.floor(usdc * STROOPS_PER_USDC));
}

export function formatTonnes(tonnes: number): string {
  return `${tonnes.toLocaleString()} tonne${tonnes === 1 ? '' : 's'}`;
}

export function calculateCreditCost(amount: number, pricePerCredit: bigint): bigint {
  return BigInt(amount) * pricePerCredit;
}

export function displayCreditCost(stroops: bigint): string {
  return `$${formatStroops(stroops)} USDC`;
}

/**
 * Serial number formatting
 * Format: {PROJECT_ID}-{VINTAGE}-{SEQUENCE:06d}
 */
export function formatSerialNumber(projectId: string, vintage: number, sequence: number): string {
  return `${projectId}-${vintage}-${sequence.toString().padStart(6, '0')}`;
}

export function parseSerialNumber(serial: string): {
  projectId: string;
  vintage: number;
  sequence: number;
} | null {
  const parts = serial.split('-');
  if (parts.length < 3) return null;
  
  return {
    projectId: parts[0],
    vintage: Number(parts[1]),
    sequence: Number(parts[2]),
  };
}

/**
 * Date formatting for retirement certificates
 */
export function formatCertificateDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Percentage calculation for retirement progress
 */
export function calculateRetirementPercentage(retired: number, issued: number): number {
  if (issued === 0) return 0;
  return Math.round((retired / issued) * 100);
}

/**
 * Validation
 */
export function isValidAmount(amount: string | number): boolean {
  const num = Number(amount);
  return num > 0 && Number.isInteger(num);
}

export function isValidBeneficiary(beneficiary: string): boolean {
  return beneficiary.trim().length > 0 && beneficiary.length <= 200;
}

export function isValidReason(reason: string): boolean {
  return reason.trim().length > 0 && reason.length <= 1000;
}
