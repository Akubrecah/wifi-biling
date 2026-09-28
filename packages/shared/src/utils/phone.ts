import { REGEX_PATTERNS } from '../constants/index.js';

/**
 * Normalizes Kenyan mobile numbers (Safaricom / Airtel / Telkom) to standard format: "2547XXXXXXXX" or "2541XXXXXXXX"
 */
export function normalizeKenyanPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number must be a non-empty string');
  }

  const clean = phone.trim().replace(/[\s\-+()]/g, '');
  const match = clean.match(REGEX_PATTERNS.KENYAN_PHONE);

  if (!match || !match[1]) {
    throw new Error(
      `Invalid Kenyan phone number format: "${phone}". Expected e.g. 0712345678 or 254712345678.`
    );
  }

  return `254${match[1]}`;
}
