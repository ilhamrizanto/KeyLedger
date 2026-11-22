import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import type { Env as AppEnv } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends AppEnv {}
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS magic_links (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, token_hash TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, name TEXT DEFAULT NULL, avatar_url TEXT DEFAULT NULL, google_id TEXT DEFAULT NULL, microsoft_id TEXT DEFAULT NULL, github_id TEXT DEFAULT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email)`,
  `CREATE TABLE IF NOT EXISTS oauth_identities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, provider TEXT NOT NULL, provider_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_provider_identity ON oauth_identities (provider, provider_id)`,
  `CREATE TABLE IF NOT EXISTS otp_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, issuer TEXT DEFAULT '', secret_encrypted TEXT NOT NULL, algorithm TEXT NOT NULL DEFAULT 'SHA1', digits INTEGER NOT NULL DEFAULT 6, period INTEGER NOT NULL DEFAULT 30, color TEXT NOT NULL DEFAULT '#6366f1', icon TEXT NOT NULL DEFAULT 'shield', hide_code INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS profile_shares (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL, shared_by_user_id INTEGER NOT NULL, shared_with_email TEXT NOT NULL, shared_with_user_id INTEGER DEFAULT NULL, can_edit INTEGER NOT NULL DEFAULT 0, can_share INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_profile_share_email ON profile_shares (profile_id, shared_with_email)`,
  `CREATE TABLE IF NOT EXISTS whitelist_users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, name TEXT DEFAULT '', role_label TEXT DEFAULT 'Member', is_admin INTEGER NOT NULL DEFAULT 0, created_by_email TEXT DEFAULT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_whitelist_email ON whitelist_users (email)`,
  `CREATE TABLE IF NOT EXISTS user_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT NOT NULL, ip_address TEXT DEFAULT NULL, user_agent TEXT DEFAULT NULL, expires_at TEXT NOT NULL, last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_sessions_token_hash ON user_sessions (token_hash)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (key_hash TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 1, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_user_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS group_members (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, member_email TEXT NOT NULL, member_user_id INTEGER DEFAULT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_group_member_email ON group_members (group_id, member_email)`,
  `CREATE TABLE IF NOT EXISTS profile_group_shares (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL, group_id INTEGER NOT NULL, shared_by_user_id INTEGER NOT NULL, can_edit INTEGER NOT NULL DEFAULT 0, can_share INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_profile_group_share ON profile_group_shares (profile_id, group_id)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER DEFAULT NULL, actor_email TEXT NOT NULL, action TEXT NOT NULL, target TEXT DEFAULT '', details TEXT DEFAULT '', ip_address TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS pinned_profiles (user_id INTEGER NOT NULL, profile_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, profile_id))`,
];

function extractCookies(headers: Headers): string {
  const setCookies = headers.getSetCookie();
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

describe('TOTPVault Workers Integration', () => {
  beforeAll(async () => {
    env.ENCRYPTION_KEY = 'TestStrongKeyForUnitTestsOnly32B!';
    for (const sql of SCHEMA_STATEMENTS) {
      await env.DB.prepare(sql).run();
    }
  });

  it('GET /api/health returns healthy status', async () => {
    const resp = await SELF.fetch('http://localhost/api/health');
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { status: string; database: string; runtime: string };
    expect(body.status).toBe('healthy');
    expect(body.database).toBe('connected');
    expect(body.runtime).toBe('cloudflare-workers');
  });

  it('supports magic-link login, persistent session, profile CRUD, OTP generation, and logout', async () => {
    // 1. Login via magic link (works in both demo and production)
    const { createMagicLink } = await import('../src/services/magic-link');
    const magicUrl = await createMagicLink('test.custodian@example.com', env);
    const magicPath = new URL(magicUrl).pathname + new URL(magicUrl).search;
    const loginResp = await SELF.fetch(`http://localhost${magicPath}`, { redirect: 'manual' });
    expect(loginResp.status).toBe(302);
    expect(loginResp.headers.get('location')).toBe('/');
    const cookieHeader = extractCookies(loginResp.headers);
    expect(cookieHeader).toContain('keyledger_session=');
    expect(cookieHeader).toContain('keyledger_remember=');

    // 2. Access / and extract CSRF token
    const dashResp = await SELF.fetch('http://localhost/', {
      headers: { Cookie: cookieHeader },
    });
    expect(dashResp.status).toBe(200);
    const html = await dashResp.text();
    const csrfMatch = html.match(/const CSRF = "([^"]+)"/);
    expect(csrfMatch).not.toBeNull();
    const csrf = csrfMatch![1]!;
    const allCookies = `${cookieHeader}; ${extractCookies(dashResp.headers)}`;

    // 3. Create profile
    const createResp = await SELF.fetch('http://localhost/api/profiles', {
      method: 'POST',
      headers: {
        Cookie: allCookies,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify({
        name: 'GitHub Test',
        issuer: 'GitHub',
        secret: 'JBSWY3DPEHPK3PXP',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      }),
    });
    expect(createResp.status).toBe(200);
    const created = (await createResp.json()) as { success: boolean; id: number };
    expect(created.success).toBe(true);
    expect(created.id).toBeGreaterThan(0);

    // 4. Generate OTP
    const otpResp = await SELF.fetch(`http://localhost/api/otp/${created.id}`, {
      headers: { Cookie: allCookies },
    });
    expect(otpResp.status).toBe(200);
    const otp = (await otpResp.json()) as { code: string; remaining: number };
    expect(otp.code).toMatch(/^\d{6}$/);
    expect(otp.remaining).toBeGreaterThan(0);

    // 5. Delete profile
    const delResp = await SELF.fetch(`http://localhost/api/profiles/${created.id}`, {
      method: 'DELETE',
      headers: {
        Cookie: allCookies,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify({}),
    });
    expect(delResp.status).toBe(200);
    expect(((await delResp.json()) as { success: boolean }).success).toBe(true);

    // 6. Logout revokes session
    const logoutResp = await SELF.fetch('http://localhost/auth/logout', {
      headers: { Cookie: allCookies },
      redirect: 'manual',
    });
    expect(logoutResp.status).toBe(302);
  });

  it('allows any Google OAuth user to sign up without whitelist when AUTH_OPEN_SIGNUP is enabled', async () => {
    const { isEmailAllowed, findOrCreateOAuthUser } = await import('../src/services/auth');
    const randomEmail = 'any.google.user@gmail.com';
    expect(await isEmailAllowed(randomEmail, env)).toBe(true);

    const created = await findOrCreateOAuthUser(
      {
        provider: 'google',
        provider_id: 'google-sub-123456',
        email: randomEmail,
        name: 'Any Google User',
        avatar_url: null,
      },
      env
    );
    expect(created.email).toBe(randomEmail);
    expect(created.is_admin).toBe(0);
  });

  it('supports Dynamic Custody Groups and group-based TOTP sharing', async () => {
    const { createMagicLink } = await import('../src/services/magic-link');
    const ownerMagic = await createMagicLink('group.owner@example.com', env);
    const ownerLogin = await SELF.fetch(
      `http://localhost${new URL(ownerMagic).pathname + new URL(ownerMagic).search}`,
      { redirect: 'manual' }
    );
    const ownerCookie = extractCookies(ownerLogin.headers);
    const dashResp = await SELF.fetch('http://localhost/', { headers: { Cookie: ownerCookie } });
    const html = await dashResp.text();
    const csrf = html.match(/const CSRF = "([^"]+)"/)![1]!;
    const allOwnerCookies = `${ownerCookie}; ${extractCookies(dashResp.headers)}`;

    // 1. Create a group with a member email
    const grpResp = await SELF.fetch('http://localhost/api/groups', {
      method: 'POST',
      headers: { Cookie: allOwnerCookies, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ name: 'DevOps', description: 'Infra team', members: ['devops.member@example.com'] }),
    });
    expect(grpResp.status).toBe(200);
    const grp = (await grpResp.json()) as { success: boolean; id: number };
    expect(grp.id).toBeGreaterThan(0);

    // 2. Create a TOTP profile and share it with the group
    const profResp = await SELF.fetch('http://localhost/api/profiles', {
      method: 'POST',
      headers: { Cookie: allOwnerCookies, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ name: 'CF Prod', issuer: 'Cloudflare', secret: 'JBSWY3DPEHPK3PXP' }),
    });
    const prof = (await profResp.json()) as { id: number };

    const shareResp = await SELF.fetch(`http://localhost/api/profiles/${prof.id}/group-shares`, {
      method: 'POST',
      headers: { Cookie: allOwnerCookies, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ group_id: grp.id, can_edit: false }),
    });
    expect(shareResp.status).toBe(200);

    // 3. Sign in as the group member and verify OTP generation works
    const memberMagic = await createMagicLink('devops.member@example.com', env);
    const memberLogin = await SELF.fetch(
      `http://localhost${new URL(memberMagic).pathname + new URL(memberMagic).search}`,
      { redirect: 'manual' }
    );
    const memberCookie = extractCookies(memberLogin.headers);
    const otpResp = await SELF.fetch(`http://localhost/api/otp/${prof.id}`, {
      headers: { Cookie: memberCookie },
    });
    expect(otpResp.status).toBe(200);
    const otp = (await otpResp.json()) as { code: string };
    expect(otp.code).toMatch(/^\d{6}$/);

    // 4. Owner shares with a delegate manager with can_share=true; manager forwards to their own group
    const fwdShareResp = await SELF.fetch(`http://localhost/api/profiles/${prof.id}/shares`, {
      method: 'POST',
      headers: { Cookie: allOwnerCookies, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ email: 'manager@example.com', can_edit: false, can_share: true }),
    });
    expect(fwdShareResp.status).toBe(200);

    const mgrMagic = await createMagicLink('manager@example.com', env);
    const mgrLogin = await SELF.fetch(
      `http://localhost${new URL(mgrMagic).pathname + new URL(mgrMagic).search}`,
      { redirect: 'manual' }
    );
    const mgrCookie = extractCookies(mgrLogin.headers);
    const mgrDash = await SELF.fetch('http://localhost/', { headers: { Cookie: mgrCookie } });
    const mgrCsrf = (await mgrDash.text()).match(/const CSRF = "([^"]+)"/)![1]!;
    const allMgrCookies = `${mgrCookie}; ${extractCookies(mgrDash.headers)}`;

    const mgrGrpResp = await SELF.fetch('http://localhost/api/groups', {
      method: 'POST',
      headers: { Cookie: allMgrCookies, 'Content-Type': 'application/json', 'X-CSRF-Token': mgrCsrf },
      body: JSON.stringify({ name: 'Managers Team', members: ['sub.member@example.com'] }),
    });
    const mgrGrp = (await mgrGrpResp.json()) as { id: number };

    const mgrForwardResp = await SELF.fetch(`http://localhost/api/profiles/${prof.id}/group-shares`, {
      method: 'POST',
      headers: { Cookie: allMgrCookies, 'Content-Type': 'application/json', 'X-CSRF-Token': mgrCsrf },
      body: JSON.stringify({ group_id: mgrGrp.id, can_edit: false, can_share: false }),
    });
    expect(mgrForwardResp.status).toBe(200);
    expect(((await mgrForwardResp.json()) as { success: boolean }).success).toBe(true);

    // 5. Pin profile, reveal owner-only QR URI (blocked for non-owner), and list active sessions
    const pinResp = await SELF.fetch(`http://localhost/api/profiles/${prof.id}/pin`, {
      method: 'POST',
      headers: { Cookie: allOwnerCookies, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({}),
    });
    expect(pinResp.status).toBe(200);
    expect(((await pinResp.json()) as { pinned: boolean }).pinned).toBe(true);

    const ownerQrResp = await SELF.fetch(`http://localhost/api/profiles/${prof.id}/qr-uri`, {
      headers: { Cookie: allOwnerCookies },
    });
    expect(ownerQrResp.status).toBe(200);
    expect(((await ownerQrResp.json()) as { uri: string }).uri).toContain('otpauth://totp/');

    const memberQrResp = await SELF.fetch(`http://localhost/api/profiles/${prof.id}/qr-uri`, {
      headers: { Cookie: memberCookie },
    });
    expect(memberQrResp.status).toBe(403);

    const sessionsResp = await SELF.fetch('http://localhost/api/sessions', {
      headers: { Cookie: allOwnerCookies },
    });
    expect(sessionsResp.status).toBe(200);
    const sessions = (await sessionsResp.json()) as Array<{ is_current: boolean }>;
    expect(sessions.some((s) => s.is_current)).toBe(true);
  });
});
