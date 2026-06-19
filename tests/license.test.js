import { describe, test, expect } from 'vitest';
import { validateLicenseKey } from '../src/license/license.js';

// Mirrors the HMAC computation in license.js using the placeholder secret.
// If the secret changes at deploy time, update this helper accordingly.
async function computeKey(email, secret = '__REPLACE_WITH_WORKER_SECRET__') {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(email.toLowerCase().trim()));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('validateLicenseKey', () => {
  test('returns true for a valid key+email pair', async () => {
    const email = 'buyer@example.com';
    const key = await computeKey(email);
    expect(await validateLicenseKey(key, email)).toBe(true);
  });

  test('normalizes email to lowercase before comparing', async () => {
    const key = await computeKey('buyer@example.com');
    expect(await validateLicenseKey(key, 'BUYER@EXAMPLE.COM')).toBe(true);
  });

  test('trims whitespace from email before comparing', async () => {
    const key = await computeKey('buyer@example.com');
    expect(await validateLicenseKey(key, '  buyer@example.com  ')).toBe(true);
  });

  test('returns false for wrong key', async () => {
    expect(await validateLicenseKey('deadbeef'.repeat(8), 'buyer@example.com')).toBe(false);
  });

  test('returns false for wrong email', async () => {
    const key = await computeKey('buyer@example.com');
    expect(await validateLicenseKey(key, 'other@example.com')).toBe(false);
  });

  test('returns false for empty key', async () => {
    expect(await validateLicenseKey('', 'buyer@example.com')).toBe(false);
  });

  test('returns false for empty email', async () => {
    expect(await validateLicenseKey('somekey', '')).toBe(false);
  });

  test('returns false for null key', async () => {
    expect(await validateLicenseKey(null, 'buyer@example.com')).toBe(false);
  });

  test('returns false for null email', async () => {
    expect(await validateLicenseKey('somekey', null)).toBe(false);
  });

  test('returns false for numeric inputs', async () => {
    expect(await validateLicenseKey(12345, 'buyer@example.com')).toBe(false);
  });
});
