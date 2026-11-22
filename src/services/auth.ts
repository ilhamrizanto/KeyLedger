import { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { AppContext, Env, User } from '../types';
import { isRequestHttps, randomHex, sha256Hex } from '../lib/cookies';
import { isValidEmail } from '../lib/html';

function parseCsvList(val?: string): string[] {
  if (!val) return [];
  return val
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Ensure ADMIN_EMAILS from environment are seeded into whitelist_users.
 */
export async function syncEnvAdmins(env: Env): Promise<void> {
  const admins = parseCsvList(env.ADMIN_EMAILS);
  if (admins.length === 0) return;

  const stmt = env.DB.prepare(
    `INSERT INTO whitelist_users (email, name, role_label, is_admin, created_by_email)
     VALUES (?, ?, 'Administrator', 1, 'SYSTEM_ENV')
     ON CONFLICT(email) DO UPDATE SET is_admin = 1, role_label = 'Administrator'`
  );

  const batch: D1PreparedStatement[] = [];
  for (const email of admins) {
    if (!isValidEmail(email)) continue;
    const local = email.split('@')[0] ?? 'Admin';
    const name = local.charAt(0).toUpperCase() + local.slice(1);
    batch.push(stmt.bind(email, name));
  }
  if (batch.length > 0) {
    await env.DB.batch(batch);
  }
}

export async function isEmailAllowed(email: string, env: Env): Promise<boolean> {
  // Open Google/OAuth signup: allow all valid emails unless explicitly disabled
  if (env.AUTH_OPEN_SIGNUP !== 'false') {
    return isValidEmail(email.trim().toLowerCase());
  }

  const normalized = email.trim().toLowerCase();
  const allowedEmails = parseCsvList(env.ALLOWED_EMAILS);
  const allowedDomains = parseCsvList(env.ALLOWED_DOMAINS);
  const adminEmails = parseCsvList(env.ADMIN_EMAILS);

  if (adminEmails.includes(normalized)) {
    return true;
  }

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM whitelist_users').first<{ cnt: number }>();
  const hasEntries = (countRow?.cnt ?? 0) > 0;

  if (hasEntries) {
    const match = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM whitelist_users WHERE LOWER(email) = ?')
      .bind(normalized)
      .first<{ cnt: number }>();
    if ((match?.cnt ?? 0) > 0) {
      return true;
    }
    if (allowedEmails.includes(normalized)) {
      return true;
    }
    const domain = normalized.split('@')[1];
    if (domain && allowedDomains.includes(domain)) {
      return true;
    }
    return false;
  }

  if (allowedEmails.length === 0 && allowedDomains.length === 0) {
    return true;
  }
  if (allowedEmails.includes(normalized)) {
    return true;
  }
  const domain = normalized.split('@')[1];
  if (domain && allowedDomains.includes(domain)) {
    return true;
  }
  return false;
}

export async function loadUserById(userId: number, env: Env): Promise<User | null> {
  const row = await env.DB.prepare(
    `SELECT u.*, COALESCE(w.is_admin, 0) AS is_admin, w.role_label
     FROM users u
     LEFT JOIN whitelist_users w ON LOWER(w.email) = LOWER(u.email)
     WHERE u.id = ?`
  )
    .bind(userId)
    .first<User>();

  if (!row) return null;
  if (!(await isEmailAllowed(row.email, env))) {
    return null;
  }
  row.is_admin = Number(row.is_admin ?? 0);
  return row;
}

export async function getCurrentUser(c: Context<AppContext>): Promise<User | null> {
  const env = c.env;
  const sessionCookieName = env.SESSION_COOKIE_NAME || 'totpvault_session';
  const rememberCookieName = env.REMEMBER_COOKIE_NAME || 'totpvault_remember';

  const token = getCookie(c, rememberCookieName) || getCookie(c, sessionCookieName);
  if (!token || token.length < 32) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    `SELECT id, user_id FROM user_sessions
     WHERE token_hash = ? AND expires_at > datetime('now')
     LIMIT 1`
  )
    .bind(tokenHash)
    .first<{ id: number; user_id: number }>();

  if (!session) {
    deleteCookie(c, sessionCookieName, { path: '/' });
    deleteCookie(c, rememberCookieName, { path: '/' });
    return null;
  }

  const user = await loadUserById(session.user_id, env);
  if (!user) {
    await logoutUser(c);
    return null;
  }

  // Sliding expiration: extend session in DB and refresh cookies
  const lifetime = parseInt(env.SESSION_LIFETIME || '2592000', 10) || 2592000;
  const newExpiresAt = new Date(Date.now() + lifetime * 1000).toISOString().replace('T', ' ').slice(0, 19);

  const updatePromise = env.DB.prepare(
    `UPDATE user_sessions SET last_used_at = datetime('now'), expires_at = ? WHERE id = ?`
  )
    .bind(newExpiresAt, session.id)
    .run()
    .catch((err) => console.error('Failed to extend session:', err));

  try {
    c.executionCtx.waitUntil(updatePromise);
  } catch {
    await updatePromise;
  }

  const secure = isRequestHttps(c.req.url, c.req.raw.headers, env.APP_URL);
  const cookieOpts = {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure,
    maxAge: lifetime,
  };
  setCookie(c, sessionCookieName, token, cookieOpts);
  setCookie(c, rememberCookieName, token, cookieOpts);

  return user;
}

export async function loginUser(c: Context<AppContext>, userId: number): Promise<void> {
  const env = c.env;
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const lifetime = parseInt(env.SESSION_LIFETIME || '2592000', 10) || 2592000;
  const expiresAt = new Date(Date.now() + lifetime * 1000).toISOString().replace('T', ' ').slice(0, 19);

  const ipAddress = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null;
  const userAgent = (c.req.header('user-agent') ?? '').slice(0, 500) || null;

  await env.DB.prepare(
    `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(userId, tokenHash, ipAddress, userAgent, expiresAt)
    .run();

  const secure = isRequestHttps(c.req.url, c.req.raw.headers, env.APP_URL);
  const cookieOpts = {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure,
    maxAge: lifetime,
  };

  setCookie(c, env.SESSION_COOKIE_NAME || 'totpvault_session', token, cookieOpts);
  setCookie(c, env.REMEMBER_COOKIE_NAME || 'totpvault_remember', token, cookieOpts);
}

export async function logoutUser(c: Context<AppContext>): Promise<void> {
  const env = c.env;
  const sessionCookieName = env.SESSION_COOKIE_NAME || 'totpvault_session';
  const rememberCookieName = env.REMEMBER_COOKIE_NAME || 'totpvault_remember';

  const token = getCookie(c, rememberCookieName) || getCookie(c, sessionCookieName);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare('DELETE FROM user_sessions WHERE token_hash = ?').bind(tokenHash).run().catch(() => {});
  }

  deleteCookie(c, sessionCookieName, { path: '/' });
  deleteCookie(c, rememberCookieName, { path: '/' });
}

export interface OAuthUserInput {
  provider: string;
  provider_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

export async function findOrCreateOAuthUser(data: OAuthUserInput, env: Env): Promise<User> {
  const provider = data.provider.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,64}$/.test(provider)) {
    throw new Error('Invalid OAuth provider name.');
  }

  const providerId = String(data.provider_id || '').trim();
  const email = String(data.email || '').trim().toLowerCase();

  if (!providerId || !isValidEmail(email)) {
    throw new Error('OAuth provider returned incomplete user information.');
  }

  if (!(await isEmailAllowed(email, env))) {
    throw new Error(
      `Access Denied: Account (${email}) is not registered in the system whitelist. Contact an Administrator to be added.`
    );
  }

  // 1. Lookup by oauth_identities
  let existing = await env.DB.prepare(
    `SELECT u.* FROM users u
     INNER JOIN oauth_identities oi ON oi.user_id = u.id
     WHERE oi.provider = ? AND oi.provider_id = ?
     LIMIT 1`
  )
    .bind(provider, providerId)
    .first<{ id: number }>();

  // 2. Legacy provider column fallback
  if (!existing && (provider === 'google' || provider === 'microsoft' || provider === 'github')) {
    const col = `${provider}_id`;
    existing = await env.DB.prepare(`SELECT id FROM users WHERE ${col} = ? LIMIT 1`)
      .bind(providerId)
      .first<{ id: number }>();
  }

  // 3. Fallback by email
  if (!existing) {
    existing = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1')
      .bind(email)
      .first<{ id: number }>();
  }

  let userId: number;
  if (existing) {
    userId = existing.id;
    await env.DB.prepare(
      `UPDATE users
       SET name = COALESCE(?, name),
           avatar_url = COALESCE(?, avatar_url),
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(data.name ?? null, data.avatar_url ?? null, userId)
      .run();
  } else {
    const res = await env.DB.prepare('INSERT INTO users (email, name, avatar_url) VALUES (?, ?, ?)')
      .bind(email, data.name ?? null, data.avatar_url ?? null)
      .run();
    userId = Number(res.meta.last_row_id);

    // Resolve pending shares
    await env.DB.prepare(
      'UPDATE profile_shares SET shared_with_user_id = ? WHERE LOWER(shared_with_email) = ? AND shared_with_user_id IS NULL'
    )
      .bind(userId, email)
      .run();
  }

  // Upsert oauth_identities
  await env.DB.prepare(
    `INSERT INTO oauth_identities (user_id, provider, provider_id)
     VALUES (?, ?, ?)
     ON CONFLICT(provider, provider_id) DO UPDATE SET user_id = excluded.user_id, updated_at = datetime('now')`
  )
    .bind(userId, provider, providerId)
    .run();

  if (provider === 'google' || provider === 'microsoft' || provider === 'github') {
    await env.DB.prepare(`UPDATE users SET ${provider}_id = ? WHERE id = ?`).bind(providerId, userId).run();
  }

  const saved = await loadUserById(userId, env);
  if (!saved) {
    throw new Error('Failed to load authenticated user.');
  }
  return saved;
}
