import { describe, it, expect } from 'vitest';
import { base32Decode, base32Encode, buildOtpAuthUri, generateSecret, generateTOTP } from '../src/lib/totp';
import { parseGoogleAuthMigrationUri } from '../src/lib/migration';

describe('RFC 6238 TOTP & Base32', () => {
  // RFC 6238 test secret: ASCII "12345678901234567890" -> Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('encodes and decodes Base32 roundtrip', () => {
    const raw = new TextEncoder().encode('12345678901234567890');
    const encoded = base32Encode(raw);
    expect(encoded).toBe(rfcSecret);
    expect(base32Decode(encoded)).toEqual(raw);
  });

  it('matches RFC 6238 SHA1 8-digit test vector at t=59', async () => {
    const code = await generateTOTP(rfcSecret, 'SHA1', 8, 30, 59);
    expect(code).toBe('94287082');
  });

  it('matches RFC 6238 SHA1 8-digit test vector at t=1111111109', async () => {
    const code = await generateTOTP(rfcSecret, 'SHA1', 8, 30, 1111111109);
    expect(code).toBe('07081804');
  });

  it('generates a random 32-char Base32 secret and otpauth URI', () => {
    const sec = generateSecret(32);
    expect(sec).toMatch(/^[A-Z2-7]{32}$/);
    const uri = buildOtpAuthUri(sec, 'TOTPVault', 'user@example.com');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${sec}`);
  });

  it('decodes Google Authenticator otpauth-migration://offline?data=... URI', () => {
    const sample =
      'otpauth-migration://offline?data=CjgKCoq1hGRzFqU5AJ8SB3JpemFudG8aBkdpdEh1YiABKAEwAkITMjkxODliMTc3NjIxNDkwMDA5MwpRChRLVTNteHNFa2pQM2N5RUZRcWpJZhINaWxoYW0ucml6YW50bxoPU1NPIFBFR0FXQUkgQlBTIAEoATACQhNlYzI5ZDQxNzkxODYxMTQ0NTM5CkQKCvF1OLs2gNUxqMYSFEdvb2dsZSBBdXRoZW50aWNhdG9yGgVJQk1pZCABKAEwAkITM2NkYjVhMTc5NDcyNzk0ODMyNQpOChRkRrmS33NtJSm9U%2FBnLaTS5zwRpBITdm9sZGVlMzEzQGdtYWlsLmNvbRoGR29vZ2xlIAEoATACQhMyNTBiZjgxNzk0NDczMjkyMDI0EAIYASAA';
    const accounts = parseGoogleAuthMigrationUri(sample);
    expect(accounts.length).toBe(4);
    expect(accounts[0]!.issuer).toBe('GitHub');
    expect(accounts[0]!.name).toBe('rizanto');
    expect(accounts[1]!.issuer).toBe('SSO PEGAWAI BPS');
    expect(accounts[3]!.name).toBe('voldee313@gmail.com');
  });
});
