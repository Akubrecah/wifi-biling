import { PlanType } from '../types/index.js';

export interface ExpiryCalculationParams {
  planType: PlanType;
  durationSec?: number | null;
  startTime?: Date;
}

export interface EntitlementQuotaState {
  expiresAt: Date | null;
  totalBytes?: bigint | null;
  usedBytes?: bigint;
}

/**
 * Calculates the exact expiration timestamp for an entitlement based on plan specifications.
 */
export function calculateEntitlementExpiry(
  params: ExpiryCalculationParams
): Date | null {
  const { planType, durationSec, startTime = new Date() } = params;

  // Pure data plans with no time limit do not expire on time
  if (planType === 'DATA_BASED' && (!durationSec || durationSec <= 0)) {
    return null;
  }

  if (!durationSec || durationSec <= 0) {
    if (planType === 'TIME_BASED' || planType === 'HYBRID') {
      throw new Error(`Plan type ${planType} requires a positive durationSec`);
    }
    return null;
  }

  return new Date(startTime.getTime() + durationSec * 1000);
}

/**
 * Calculates remaining seconds until entitlement expiry. Returns null if unlimited time.
 */
export function calculateRemainingSeconds(
  expiresAt: Date | null,
  now: Date = new Date()
): number | null {
  if (expiresAt === null) {
    return null;
  }

  const diffMs = expiresAt.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Calculates remaining byte quota. Returns null if unlimited data.
 */
export function calculateRemainingBytes(
  totalBytes: bigint | null | undefined,
  usedBytes: bigint = 0n
): bigint | null {
  if (totalBytes === null || totalBytes === undefined) {
    return null;
  }

  if (usedBytes >= totalBytes) {
    return 0n;
  }

  return totalBytes - usedBytes;
}

/**
 * Evaluates whether an entitlement has expired due to either time or exhausted data quota.
 */
export function isEntitlementExpired(
  state: EntitlementQuotaState,
  now: Date = new Date()
): boolean {
  const { expiresAt, totalBytes, usedBytes = 0n } = state;

  // 1. Time-based expiry check
  if (expiresAt !== null && now.getTime() >= expiresAt.getTime()) {
    return true;
  }

  // 2. Data quota exhaustion check
  if (totalBytes !== null && totalBytes !== undefined) {
    if (usedBytes >= totalBytes) {
      return true;
    }
  }

  return false;
}

/**
 * Formats a byte quantity into a clean human-readable string (e.g. 5.00 GB, 450 MB).
 */
export function formatBytes(bytes: bigint | number): string {
  const num = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (num === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  const value = (num / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2);

  return `${value} ${sizes[i]}`;
}

/**
 * Formats seconds into a human-readable duration (e.g. 2d 5h 30m, 45m 12s, 0s).
 */
export function formatRemainingDuration(seconds: number): string {
  if (seconds <= 0) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && days === 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}
