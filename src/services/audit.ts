import { Env } from '../types';

export interface AuditLogInput {
  actorUserId?: number | null;
  actorEmail: string;
  action: string;
  target?: string;
  details?: string;
  ipAddress?: string;
}

export async function recordAuditLog(env: Env, entry: AuditLogInput): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (actor_user_id, actor_email, action, target, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        entry.actorUserId ?? null,
        entry.actorEmail.trim().toLowerCase(),
        entry.action,
        (entry.target ?? '').slice(0, 255),
        (entry.details ?? '').slice(0, 500),
        (entry.ipAddress ?? '').slice(0, 100)
      )
      .run();
  } catch (err) {
    console.error('[audit-log]', err);
  }
}

export async function listAuditLogs(env: Env, limit = 100, query = '') {
  const safeLimit = Math.max(1, Math.min(250, limit));
  const q = query.trim().toLowerCase();
  if (q) {
    const like = `%${q}%`;
    const res = await env.DB.prepare(
      `SELECT id, actor_email, action, target, details, ip_address, created_at
       FROM audit_logs
       WHERE LOWER(actor_email) LIKE ? OR LOWER(action) LIKE ? OR LOWER(target) LIKE ? OR LOWER(details) LIKE ?
       ORDER BY id DESC
       LIMIT ?`
    )
      .bind(like, like, like, like, safeLimit)
      .all();
    return res.results ?? [];
  }

  const res = await env.DB.prepare(
    `SELECT id, actor_email, action, target, details, ip_address, created_at
     FROM audit_logs
     ORDER BY id DESC
     LIMIT ?`
  )
    .bind(safeLimit)
    .all();
  return res.results ?? [];
}

export async function listUserSessions(userId: number, currentTokenHash: string | null, env: Env) {
  const res = await env.DB.prepare(
    `SELECT id, token_hash, ip_address, user_agent, last_used_at, created_at, expires_at
     FROM user_sessions
     WHERE user_id = ? AND expires_at > datetime('now')
     ORDER BY last_used_at DESC`
  )
    .bind(userId)
    .all<{
      id: number;
      token_hash: string;
      ip_address: string | null;
      user_agent: string | null;
      last_used_at: string;
      created_at: string;
      expires_at: string;
    }>();

  return (res.results ?? []).map((s) => ({
    id: s.id,
    ip_address: s.ip_address || 'Unknown IP',
    user_agent: s.user_agent || 'Unknown Device',
    last_used_at: s.last_used_at,
    created_at: s.created_at,
    expires_at: s.expires_at,
    is_current: currentTokenHash !== null && s.token_hash === currentTokenHash,
  }));
}

export async function revokeUserSession(sessionId: number, userId: number, env: Env): Promise<boolean> {
  const res = await env.DB.prepare('DELETE FROM user_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, userId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function revokeOtherUserSessions(
  userId: number,
  currentTokenHash: string | null,
  env: Env
): Promise<number> {
  if (!currentTokenHash) return 0;
  const res = await env.DB.prepare(
    'DELETE FROM user_sessions WHERE user_id = ? AND token_hash != ?'
  )
    .bind(userId, currentTokenHash)
    .run();
  return res.meta.changes ?? 0;
}

export async function adminForceLogoutUser(targetEmail: string, env: Env): Promise<number> {
  const email = targetEmail.trim().toLowerCase();
  const u = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ?')
    .bind(email)
    .first<{ id: number }>();
  if (!u) return 0;

  const res = await env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?')
    .bind(u.id)
    .run();
  return res.meta.changes ?? 0;
}

export async function adminOffboardUser(targetEmail: string, env: Env) {
  const email = targetEmail.trim().toLowerCase();
  const u = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ?')
    .bind(email)
    .first<{ id: number }>();

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare('DELETE FROM profile_shares WHERE LOWER(shared_with_email) = ?').bind(email),
    env.DB.prepare('DELETE FROM group_members WHERE LOWER(member_email) = ?').bind(email),
    env.DB.prepare('DELETE FROM whitelist_users WHERE LOWER(email) = ?').bind(email),
  ];

  if (u) {
    stmts.push(env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(u.id));
  }

  const results = await env.DB.batch(stmts);
  return {
    shares_revoked: results[0]?.meta.changes ?? 0,
    groups_removed: results[1]?.meta.changes ?? 0,
    roles_removed: results[2]?.meta.changes ?? 0,
    sessions_revoked: results[3]?.meta.changes ?? 0,
  };
}
