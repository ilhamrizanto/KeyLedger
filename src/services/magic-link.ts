import { Env, User } from '../types';
import { randomHex, sha256Hex } from '../lib/cookies';
import { isEmailAllowed, loadUserById } from './auth';

const TTL_SECONDS = 900;

export async function createMagicLink(emailInput: string, env: Env): Promise<string> {
  const email = emailInput.trim().toLowerCase();
  if (!(await isEmailAllowed(email, env))) {
    throw new Error(
      `Access Denied: Email (${email}) is not registered in the system whitelist. Contact an Administrator to be added.`
    );
  }

  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM magic_links
     WHERE email = ? AND created_at > datetime('now', '-10 minutes')`
  )
    .bind(email)
    .first<{ cnt: number }>();

  if ((recent?.cnt ?? 0) >= 3) {
    throw new Error('Too many requests. Please wait a few minutes and try again.');
  }

  await env.DB.prepare('DELETE FROM magic_links WHERE email = ? AND used = 0').bind(email).run();

  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString().replace('T', ' ').slice(0, 19);

  await env.DB.prepare('INSERT INTO magic_links (email, token_hash, expires_at) VALUES (?, ?, ?)')
    .bind(email, tokenHash, expiresAt)
    .run();

  const appUrl = (env.APP_URL || 'http://localhost:8787').replace(/\/+$/, '');
  return `${appUrl}/auth/magic?token=${token}&email=${encodeURIComponent(email)}`;
}

export async function verifyMagicLink(token: string, emailInput: string, env: Env): Promise<string> {
  const email = emailInput.trim().toLowerCase();
  const tokenHash = await sha256Hex(token);

  const row = await env.DB.prepare(
    `SELECT id FROM magic_links
     WHERE email = ? AND token_hash = ? AND expires_at > datetime('now') AND used = 0
     LIMIT 1`
  )
    .bind(email, tokenHash)
    .first<{ id: number }>();

  if (!row) {
    throw new Error('This login link is invalid or has expired. Please request a new one.');
  }

  await env.DB.prepare('UPDATE magic_links SET used = 1 WHERE id = ?').bind(row.id).run();
  return email;
}

export async function findOrCreateMagicLinkUser(emailInput: string, env: Env): Promise<User> {
  const email = emailInput.trim().toLowerCase();
  const existing = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1')
    .bind(email)
    .first<{ id: number }>();

  let userId: number;
  if (!existing) {
    const res = await env.DB.prepare('INSERT INTO users (email, name) VALUES (?, ?)').bind(email, email).run();
    userId = Number(res.meta.last_row_id);

    await env.DB.batch([
      env.DB.prepare(
        'UPDATE profile_shares SET shared_with_user_id = ? WHERE LOWER(shared_with_email) = ? AND shared_with_user_id IS NULL'
      ).bind(userId, email),
      env.DB.prepare(
        'UPDATE group_members SET member_user_id = ? WHERE LOWER(member_email) = ? AND member_user_id IS NULL'
      ).bind(userId, email),
    ]);
  } else {
    userId = existing.id;
  }

  const user = await loadUserById(userId, env);
  if (!user) {
    throw new Error('Failed to load authenticated user.');
  }
  return user;
}

export async function sendMagicLinkEmail(to: string, magicUrl: string, env: Env): Promise<boolean> {
  if (!env.MAILERSEND_KEY) {
    return false;
  }

  const resp = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MAILERSEND_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: {
        email: env.MAIL_FROM_EMAIL || 'noreply@localhost',
        name: env.MAIL_FROM_NAME || 'TOTPVault',
      },
      to: [{ email: to }],
      subject: 'Your TOTPVault Sign-In Link',
      text: `Sign in to TOTPVault\n\nClick this link (expires in 15 minutes):\n${magicUrl}\n\nIf you didn't request this, ignore this email.`,
    }),
  });

  if (resp.status !== 202 && !resp.ok) {
    console.error(`MailerSend failed: HTTP ${resp.status}`);
    return false;
  }
  return true;
}
