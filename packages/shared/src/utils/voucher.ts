import crypto from 'node:crypto';

// 31 unambiguous alphanumeric characters (omitting 0, O, 1, I, L)
const VOUCHER_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates a cryptographically random, unambiguous voucher code.
 * Default format: 8 characters, e.g. "H7W8-2K4N" (or without separator)
 */
export function generateVoucherCode(length = 8, withSeparator = true): string {
  const bytes = crypto.randomBytes(length);
  let code = '';

  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      code += VOUCHER_CHARSET[byte % VOUCHER_CHARSET.length];
    }
  }

  if (withSeparator && length >= 8) {
    const mid = Math.floor(length / 2);
    return `${code.slice(0, mid)}-${code.slice(mid)}`;
  }

  return code;
}

/**
 * Normalizes a customer-entered voucher code: uppercase and strips spaces/hyphens
 */
export function normalizeVoucherCode(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Voucher code must be a non-empty string');
  }
  return input.trim().toUpperCase().replace(/[\s-]/g, '');
}
