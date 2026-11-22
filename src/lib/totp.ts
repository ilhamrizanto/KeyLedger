/**
 * RFC 6238 Server-Side TOTP Generator using Web Crypto API.
 */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_MAP = new Map<string, number>(
  Array.from(BASE32_CHARS).map((ch, idx) => [ch, idx])
);

export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().trim();
  const out: number[] = [];
  let buf = 0;
  let bufLen = 0;

  for (const ch of clean) {
    if (ch === '=') break;
    const val = BASE32_MAP.get(ch);
    if (val === undefined) continue;
    buf = (buf << 5) | val;
    bufLen += 5;
    if (bufLen >= 8) {
      bufLen -= 8;
      out.push((buf >> bufLen) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function base32Encode(input: Uint8Array): string {
  let output = '';
  let buf = 0;
  let bufLen = 0;

  for (const byte of input) {
    buf = (buf << 8) | byte;
    bufLen += 8;
    while (bufLen >= 5) {
      bufLen -= 5;
      output += BASE32_CHARS[(buf >> bufLen) & 0x1f]!;
    }
  }
  if (bufLen > 0) {
    output += BASE32_CHARS[(buf << (5 - bufLen)) & 0x1f]!;
  }
  return output;
}

export function generateSecret(length = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil((length * 5) / 8)));
  return base32Encode(bytes).slice(0, length);
}

function mapHmacAlgorithm(algorithm: string): 'SHA-1' | 'SHA-256' | 'SHA-512' {
  switch (algorithm.toUpperCase()) {
    case 'SHA256':
    case 'SHA-256':
      return 'SHA-256';
    case 'SHA512':
    case 'SHA-512':
      return 'SHA-512';
    default:
      return 'SHA-1';
  }
}

export async function generateTOTP(
  secret: string,
  algorithm = 'SHA1',
  digits = 6,
  period = 30,
  timeSeconds?: number
): Promise<string> {
  const now = timeSeconds ?? Math.floor(Date.now() / 1000);
  const keyBytes = base32Decode(secret);
  const counter = BigInt(Math.floor(now / period));

  const msg = new ArrayBuffer(8);
  new DataView(msg).setBigUint64(0, counter, false);

  const hashName = mapHmacAlgorithm(algorithm);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.length > 0 ? keyBytes : new Uint8Array([0]),
    { name: 'HMAC', hash: hashName },
    false,
    ['sign']
  );

  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msg));
  const offset = sig[sig.length - 1]! & 0x0f;

  const code =
    (((sig[offset]! & 0x7f) << 24) |
      ((sig[offset + 1]! & 0xff) << 16) |
      ((sig[offset + 2]! & 0xff) << 8) |
      (sig[offset + 3]! & 0xff)) >>>
    0;

  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, '0');
}

export function secondsRemaining(period = 30, timeSeconds?: number): number {
  const now = timeSeconds ?? Math.floor(Date.now() / 1000);
  return period - (now % period);
}

export function totpProgress(period = 30, timeSeconds?: number): number {
  const now = timeSeconds ?? Math.floor(Date.now() / 1000);
  return ((now % period) / period) * 100;
}

export function buildOtpAuthUri(
  secret: string,
  issuer: string,
  account: string,
  algorithm = 'SHA1',
  digits = 6,
  period = 30
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: algorithm.toUpperCase(),
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?${params.toString()}`;
}
