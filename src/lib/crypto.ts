/**
 * AES-256-GCM encryption/decryption using Web Crypto API.
 * Binary-compatible with PHP `src/Crypto.php`:
 *   payload = base64(iv[12] || tag[16] || ciphertext)
 */

const DEFAULT_TEST_KEY = 'ThisIsA32ByteKeyForLocalTesting!';

function deriveRawKeyBytes(keyStr: string, appEnv: string): Uint8Array {
  const isDev = appEnv === 'development' || appEnv === 'demo';
  if (!keyStr) {
    throw new Error('FATAL: ENCRYPTION_KEY is not configured.');
  }
  if (!isDev && (keyStr === DEFAULT_TEST_KEY || keyStr.length < 16)) {
    throw new Error(
      'SECURITY ERROR: Default or weak ENCRYPTION_KEY detected in production mode. Set a strong 32-byte ENCRYPTION_KEY secret.'
    );
  }

  const encoded = new TextEncoder().encode(keyStr);
  const keyBytes = new Uint8Array(32); // zero-padded like PHP str_pad($key, 32, "\0")
  keyBytes.set(encoded.subarray(0, 32));
  return keyBytes;
}

async function importAesKey(
  keyStr: string,
  appEnv: string,
  usages: Array<'encrypt' | 'decrypt'>
): Promise<CryptoKey> {
  const raw = deriveRawKeyBytes(keyStr, appEnv);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, usages);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptSecret(plaintext: string, keyStr: string, appEnv = 'production'): Promise<string> {
  const key = await importAesKey(keyStr, appEnv, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    data
  );

  const encrypted = new Uint8Array(encryptedBuf);
  const ctLen = encrypted.length - 16;
  const ciphertext = encrypted.subarray(0, ctLen);
  const tag = encrypted.subarray(ctLen);

  // Store: iv (12) || tag (16) || ciphertext
  const combined = new Uint8Array(12 + 16 + ctLen);
  combined.set(iv, 0);
  combined.set(tag, 12);
  combined.set(ciphertext, 28);

  return bytesToBase64(combined);
}

export async function decryptSecret(encoded: string, keyStr: string, appEnv = 'production'): Promise<string> {
  let raw: Uint8Array;
  try {
    raw = base64ToBytes(encoded);
  } catch {
    throw new Error('Invalid encrypted payload encoding.');
  }

  if (raw.length < 28) {
    throw new Error('Invalid encrypted payload structure.');
  }

  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  // Web Crypto expects ciphertext || tag
  const combined = new Uint8Array(ciphertext.length + 16);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const key = await importAesKey(keyStr, appEnv, ['decrypt']);
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      combined
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    throw new Error('Decryption failed: data may be tampered or key mismatched.');
  }
}
