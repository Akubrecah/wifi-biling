import { REGEX_PATTERNS } from '../constants/index.js';

/**
 * Validates and normalizes any MAC address to standard uppercase format: "AA:BB:CC:DD:EE:FF"
 */
export function normalizeMacAddress(mac: string): string {
  if (!mac || typeof mac !== 'string') {
    throw new Error('Invalid MAC address: input must be a non-empty string');
  }

  const clean = mac.trim().replace(/[-.]/g, ':');
  if (!REGEX_PATTERNS.MAC_ADDRESS.test(clean)) {
    throw new Error(`Invalid MAC address format: "${mac}"`);
  }

  return clean.toUpperCase();
}

/**
 * Checks if a MAC address appears to be a locally administered / randomized address.
 * IEEE 802 standard: the second least significant bit of the first byte is set to 1 for locally administered addresses.
 * (e.g. x2, x6, xA, xE as the second character of the first octet)
 */
export function isLocallyAdministeredMac(mac: string): boolean {
  try {
    const normalized = normalizeMacAddress(mac);
    const firstOctetHex = normalized.substring(0, 2);
    const firstOctetInt = parseInt(firstOctetHex, 16);
    // Bit 1 (0-indexed from LSB) is the U/L (Universal/Local) bit
    return (firstOctetInt & 0x02) === 0x02;
  } catch {
    return false;
  }
}
