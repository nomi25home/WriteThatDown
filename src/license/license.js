// WORKER_SECRET must match the secret configured in worker/wrangler.toml.
// Replace '__REPLACE_WITH_WORKER_SECRET__' before deployment.
const WORKER_SECRET = '__REPLACE_WITH_WORKER_SECRET__';

async function computeHmac(email) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(WORKER_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(email.toLowerCase().trim()));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function validateLicenseKey(key, email) {
  if (!key || !email || typeof key !== 'string' || typeof email !== 'string') return false;
  try {
    const expected = await computeHmac(email);
    return key.toLowerCase() === expected;
  } catch {
    return false;
  }
}

export async function storeLicense(key, email) {
  await chrome.storage.local.set({
    license: { key: key.toLowerCase(), email: email.toLowerCase().trim() },
  });
}

export async function getLicense() {
  const result = await chrome.storage.local.get(['license']);
  return result.license ?? null;
}

export async function isLicensed() {
  const license = await getLicense();
  if (!license?.key || !license?.email) return false;
  return validateLicenseKey(license.key, license.email);
}
