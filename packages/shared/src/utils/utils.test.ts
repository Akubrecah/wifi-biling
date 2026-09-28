import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMacAddress, isLocallyAdministeredMac } from './mac.js';
import { normalizeKenyanPhoneNumber } from './phone.js';
import { formatMikrotikRateLimit } from './rate-limit.js';
import { generateVoucherCode, normalizeVoucherCode } from './voucher.js';
import {
  calculateEntitlementExpiry,
  calculateRemainingSeconds,
  calculateRemainingBytes,
  isEntitlementExpired,
  formatBytes,
  formatRemainingDuration,
} from './entitlement.js';

describe('Shared Utilities Test Suite', () => {
  describe('MAC Address Utilities', () => {
    it('should normalize various MAC formats to uppercase colon format', () => {
      assert.equal(normalizeMacAddress('aa:bb:cc:dd:ee:ff'), 'AA:BB:CC:DD:EE:FF');
      assert.equal(normalizeMacAddress('AA-BB-CC-DD-EE-FF'), 'AA:BB:CC:DD:EE:FF');
      assert.equal(normalizeMacAddress('  00:1a:2b:3c:4d:5e  '), '00:1A:2B:3C:4D:5E');
    });

    it('should throw error for invalid MAC addresses', () => {
      assert.throws(() => normalizeMacAddress('invalid-mac'));
      assert.throws(() => normalizeMacAddress('00:11:22:33:44'));
      assert.throws(() => normalizeMacAddress(''));
    });

    it('should detect locally administered (randomized) MACs', () => {
      // 02, 06, 0A, 0E have the locally administered bit set (bit 1)
      assert.equal(isLocallyAdministeredMac('02:11:22:33:44:55'), true);
      assert.equal(isLocallyAdministeredMac('DA:A1:19:64:55:22'), true);
      assert.equal(isLocallyAdministeredMac('00:11:22:33:44:55'), false);
    });
  });

  describe('Kenyan Phone Utilities', () => {
    it('should normalize standard Kenyan mobile numbers to 2547XXXXXXXX or 2541XXXXXXXX', () => {
      assert.equal(normalizeKenyanPhoneNumber('0712345678'), '254712345678');
      assert.equal(normalizeKenyanPhoneNumber('+254712345678'), '254712345678');
      assert.equal(normalizeKenyanPhoneNumber('254712345678'), '254712345678');
      assert.equal(normalizeKenyanPhoneNumber('0112345678'), '254112345678');
      assert.equal(normalizeKenyanPhoneNumber('  0722-123 456  '), '254722123456');
    });

    it('should throw error for invalid numbers', () => {
      assert.throws(() => normalizeKenyanPhoneNumber('12345'));
      assert.throws(() => normalizeKenyanPhoneNumber('0812345678'));
      assert.throws(() => normalizeKenyanPhoneNumber(''));
    });
  });

  describe('MikroTik Rate-Limit Formatter', () => {
    it('should format simple upload/download rate-limit string', () => {
      const rateLimit = formatMikrotikRateLimit({
        uploadSpeedKbps: 2048,
        downloadSpeedKbps: 5120,
      });
      assert.equal(rateLimit, '2048k/5120k');
    });

    it('should format complete burst rate-limit string according to RouterOS specifications', () => {
      const rateLimit = formatMikrotikRateLimit({
        uploadSpeedKbps: 2048,
        downloadSpeedKbps: 5120,
        burstUploadKbps: 4096,
        burstDownloadKbps: 10240,
        burstThresholdUpKbps: 1536,
        burstThresholdDownKbps: 3840,
        burstDurationSeconds: 15,
        priority: 7,
      });
      assert.equal(rateLimit, '2048k/5120k 4096k/10240k 1536k/3840k 15/15 7');
    });
  });

  describe('Voucher Utilities', () => {
    it('should generate valid unambiguous voucher codes', () => {
      const code = generateVoucherCode(8, true);
      assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
      // Ensure no 0, O, 1, I, L
      assert.doesNotMatch(code, /[0O1IL]/);
    });

    it('should normalize user-entered voucher code', () => {
      assert.equal(normalizeVoucherCode('  h7w8-2k4n  '), 'H7W82K4N');
      assert.equal(normalizeVoucherCode('H7W8 2K4N'), 'H7W82K4N');
    });
  });

  describe('Entitlement & Expiry Engine', () => {
    it('should calculate expiry timestamp for time-based plans', () => {
      const start = new Date('2026-09-28T10:00:00.000Z');
      const expiry = calculateEntitlementExpiry({
        planType: 'TIME_BASED',
        durationSec: 3600, // 1 hour
        startTime: start,
      });

      assert.ok(expiry);
      assert.equal(expiry.toISOString(), '2026-09-28T11:00:00.000Z');
    });

    it('should return null expiry for pure data-based plans without time limit', () => {
      const expiry = calculateEntitlementExpiry({
        planType: 'DATA_BASED',
        durationSec: null,
      });

      assert.equal(expiry, null);
    });

    it('should calculate remaining seconds correctly', () => {
      const now = new Date('2026-09-28T10:00:00.000Z');
      const expiresAt = new Date('2026-09-28T10:30:00.000Z');
      const remaining = calculateRemainingSeconds(expiresAt, now);
      assert.equal(remaining, 1800);

      // Return 0 if already passed
      const past = new Date('2026-09-28T09:00:00.000Z');
      assert.equal(calculateRemainingSeconds(past, now), 0);

      // Return null for unlimited time
      assert.equal(calculateRemainingSeconds(null, now), null);
    });

    it('should calculate remaining data bytes correctly', () => {
      const total = 5368709120n; // 5 GB
      const used = 1073741824n;  // 1 GB
      assert.equal(calculateRemainingBytes(total, used), 4294967296n); // 4 GB

      // Capped at 0 when used exceeds total
      assert.equal(calculateRemainingBytes(total, 6000000000n), 0n);

      // Null for uncapped data
      assert.equal(calculateRemainingBytes(null, used), null);
    });

    it('should determine entitlement expiration state accurately', () => {
      const now = new Date('2026-09-28T12:00:00.000Z');

      // 1. Time-expired
      assert.equal(
        isEntitlementExpired({
          expiresAt: new Date('2026-09-28T11:59:59.000Z'),
          totalBytes: null,
          usedBytes: 0n,
        }, now),
        true
      );

      // 2. Data quota exhausted
      assert.equal(
        isEntitlementExpired({
          expiresAt: new Date('2026-09-28T13:00:00.000Z'),
          totalBytes: 1000n,
          usedBytes: 1000n,
        }, now),
        true
      );

      // 3. Still valid
      assert.equal(
        isEntitlementExpired({
          expiresAt: new Date('2026-09-28T13:00:00.000Z'),
          totalBytes: 5000n,
          usedBytes: 2000n,
        }, now),
        false
      );
    });

    it('should format bytes and durations for human consumption', () => {
      assert.equal(formatBytes(0), '0 B');
      assert.equal(formatBytes(1024), '1.00 KB');
      assert.equal(formatBytes(5368709120n), '5.00 GB');

      assert.equal(formatRemainingDuration(0), '0s');
      assert.equal(formatRemainingDuration(45), '45s');
      assert.equal(formatRemainingDuration(3665), '1h 1m 5s');
      assert.equal(formatRemainingDuration(90000), '1d 1h');
    });
  });
});

