import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMacAddress, isLocallyAdministeredMac } from './mac.js';
import { normalizeKenyanPhoneNumber } from './phone.js';
import { formatMikrotikRateLimit } from './rate-limit.js';
import { generateVoucherCode, normalizeVoucherCode } from './voucher.js';

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
});
