import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../src/lib/crypto';

describe('AES-256-GCM Crypto (PHP-compatible)', () => {
  const testKey = 'ThisIsA32ByteKeyForLocalTesting!';

  it('encrypts and decrypts a TOTP secret roundtrip', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = await encryptSecret(secret, testKey, 'demo');
    const decrypted = await decryptSecret(encrypted, testKey, 'demo');
    expect(decrypted).toBe(secret);
  });

  it('produces binary layout base64(iv[12] || tag[16] || ciphertext)', async () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const encrypted = await encryptSecret(secret, testKey, 'demo');
    const raw = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    expect(raw.length).toBe(12 + 16 + secret.length);
  });

  it('rejects default testing key in production mode', async () => {
    await expect(encryptSecret('JBSWY3DPEHPK3PXP', testKey, 'production')).rejects.toThrow(
      /Default or weak ENCRYPTION_KEY/
    );
  });

  it('fails decryption with wrong key', async () => {
    const encrypted = await encryptSecret('JBSWY3DPEHPK3PXP', testKey, 'demo');
    await expect(decryptSecret(encrypted, 'Another32ByteSecretKeyForTesting', 'production')).rejects.toThrow(
      /Decryption failed/
    );
  });
});
