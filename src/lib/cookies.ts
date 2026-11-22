/**
 * Cryptographic & Cookie helpers for Cloudflare Workers.
 */

export function randomHex(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret || 'fallback-dev-hmac-secret');
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signToken(value: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  const sigHex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${value}.${sigHex}`;
}

export async function verifySignedToken(signed: string, secret: string): Promise<string | null> {
  const dotIdx = signed.lastIndexOf('.');
  if (dotIdx <= 0) return null;
  const value = signed.slice(0, dotIdx);
  const expected = await signToken(value, secret);
  if (!timingSafeEqualStrings(signed, expected)) {
    return null;
  }
  return value;
}

export function isRequestHttps(reqUrl: string, headers: Headers, appUrl?: string): boolean {
  if (reqUrl.startsWith('https://')) return true;
  if (headers.get('x-forwarded-proto')?.toLowerCase() === 'https') return true;
  if (appUrl?.startsWith('https://')) return true;
  return false;
}
