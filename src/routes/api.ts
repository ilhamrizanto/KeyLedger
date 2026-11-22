import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { AppContext } from '../types';
import { checkRateLimit } from '../lib/rate-limiter';
import { sha256Hex, timingSafeEqualStrings } from '../lib/cookies';
import { generateSecret } from '../lib/totp';
import { parseGoogleAuthMigrationUri } from '../lib/migration';
import { isValidEmail } from '../lib/html';
import {
  bulkMultiShare,
  bulkRevokeShares,
  createProfile,
  createProfileBatch,
  deleteProfile,
  exportProfilesForUser,
  generateProfileOTP,
  getAccessOverviewMetrics,
  getAllActiveShares,
  getAllProfilesForAdmin,
  getOwnerOtpAuthUri,
  getProfile,
  getProfileShares,
  getTokenAccessMatrix,
  getUserAccessMatrix,
  ProfileInput,
  revokeAllUserShares,
  shareProfile,
  syncTokenShares,
  syncUserShares,
  togglePinProfile,
  unshareProfile,
  updateProfile,
} from '../services/profile';
import {
  addGroupMembers,
  adminRevokeGroupShare,
  createGroup,
  deleteGroup,
  getAllActiveGroupShares,
  getProfileGroupShares,
  listGroupsForUser,
  removeGroupMember,
  shareProfileWithGroup,
  unshareProfileFromGroup,
} from '../services/groups';
import {
  adminForceLogoutUser,
  adminOffboardUser,
  listAuditLogs,
  listUserSessions,
  recordAuditLog,
  revokeOtherUserSessions,
  revokeUserSession,
} from '../services/audit';

export const apiRoutes = new Hono<AppContext>();

async function verifyCsrf(c: { req: { header: (k: string) => string | undefined; json: () => Promise<unknown> }; get: (k: 'csrfToken') => string }, bodyData?: Record<string, unknown>): Promise<boolean> {
  const expected = c.get('csrfToken');
  const headerToken = c.req.header('x-csrf-token') || '';
  const bodyToken = typeof bodyData?._csrf === 'string' ? bodyData._csrf : '';
  const provided = bodyToken || headerToken;
  if (!expected || !provided) return false;
  return timingSafeEqualStrings(expected, provided);
}

// Require authenticated user for all protected API routes
apiRoutes.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// ── OTP Generation ───────────────────────────────────────────────────────────

apiRoutes.get('/otp/:id?', async (c) => {
  const user = c.get('user')!;
  const rl = await checkRateLimit(c.env.DB, `otp:uid_${user.id}`, 180, 60);
  if (!rl.allowed) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: `Too many requests. Please wait ${rl.retryAfter} seconds.` }, 429);
  }

  const profileId = Number(c.req.param('id') ?? c.req.query('id') ?? 0);
  try {
    const otp = await generateProfileOTP(profileId, user.id, c.env);
    return c.json(otp);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Access denied' }, 403);
  }
});

apiRoutes.get('/totp/:id?', async (c) => {
  const user = c.get('user')!;
  const rl = await checkRateLimit(c.env.DB, `otp:uid_${user.id}`, 180, 60);
  if (!rl.allowed) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: `Too many requests. Please wait ${rl.retryAfter} seconds.` }, 429);
  }

  const profileId = Number(c.req.param('id') ?? c.req.query('id') ?? 0);
  try {
    const otp = await generateProfileOTP(profileId, user.id, c.env);
    return c.json(otp);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Access denied' }, 403);
  }
});

// ── Profiles CRUD ────────────────────────────────────────────────────────────

apiRoutes.post('/parse-migration', async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }
  const uri = String(data.uri || '').trim();
  try {
    const accounts = parseGoogleAuthMigrationUri(uri);
    return c.json({ success: true, profiles: accounts });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to parse migration URI' }, 400);
  }
});

apiRoutes.post('/profiles/batch', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const rl = await checkRateLimit(c.env.DB, `prof_batch:uid_${user.id}`, 30, 60);
  if (!rl.allowed) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: `Too many requests. Please wait ${rl.retryAfter} seconds.` }, 429);
  }

  const items = Array.isArray(data.profiles) ? (data.profiles as ProfileInput[]) : [];
  if (items.length === 0) {
    return c.json({ error: 'No profiles provided in payload.' }, 400);
  }

  try {
    const importedCount = await createProfileBatch(user.id, items, c.env);
    return c.json({ success: true, imported_count: importedCount });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Batch import failed' }, 400);
  }
});

apiRoutes.post('/profiles', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const rl = await checkRateLimit(c.env.DB, `prof_create:uid_${user.id}`, 60, 60);
  if (!rl.allowed) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: `Too many requests. Please wait ${rl.retryAfter} seconds.` }, 429);
  }

  try {
    const id = await createProfile(user.id, data as unknown as ProfileInput, c.env);
    await recordAuditLog(c.env, {
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'PROFILE_CREATE',
      target: String(data.name || id),
      ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
    });
    return c.json({ success: true, id });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Create failed' }, 400);
  }
});

apiRoutes.post('/profiles/:id/pin', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }
  const profileId = Number(c.req.param('id'));
  try {
    const pinned = await togglePinProfile(profileId, user.id, c.env);
    return c.json({ success: true, pinned });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Pin failed' }, 403);
  }
});

apiRoutes.get('/profiles/:id/qr-uri', async (c) => {
  const user = c.get('user')!;
  const profileId = Number(c.req.param('id'));
  try {
    const uri = await getOwnerOtpAuthUri(profileId, user.id, c.env);
    await recordAuditLog(c.env, {
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'REVEAL_QR',
      target: `profile#${profileId}`,
      ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
    });
    return c.json({ uri });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Access denied' }, 403);
  }
});

// ── Active Sessions (Self-Service) ──────────────────────────────────────────

apiRoutes.get('/sessions', async (c) => {
  const user = c.get('user')!;
  const token =
    getCookie(c, c.env.REMEMBER_COOKIE_NAME || 'totpvault_remember') ||
    getCookie(c, c.env.SESSION_COOKIE_NAME || 'totpvault_session');
  const currentHash = token ? await sha256Hex(token) : null;
  return c.json(await listUserSessions(user.id, currentHash, c.env));
});

apiRoutes.post('/sessions/revoke-others', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }
  const token =
    getCookie(c, c.env.REMEMBER_COOKIE_NAME || 'totpvault_remember') ||
    getCookie(c, c.env.SESSION_COOKIE_NAME || 'totpvault_session');
  const currentHash = token ? await sha256Hex(token) : null;
  const revoked = await revokeOtherUserSessions(user.id, currentHash, c.env);
  return c.json({ success: true, revoked });
});

apiRoutes.delete('/sessions/:id', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }
  const id = Number(c.req.param('id'));
  const ok = await revokeUserSession(id, user.id, c.env);
  return c.json({ success: ok });
});

apiRoutes.get('/profiles/:id', async (c) => {
  const user = c.get('user')!;
  const profileId = Number(c.req.param('id'));
  const profile = await getProfile(profileId, user.id, c.env);
  if (!profile) {
    return c.json({ error: 'Not found' }, 404);
  }
  const { secret_encrypted: _, ...safe } = profile;
  return c.json(safe);
});

apiRoutes.put('/profiles/:id', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const profileId = Number(c.req.param('id'));
  const ok = await updateProfile(profileId, user.id, data as Partial<ProfileInput>, c.env);
  return c.json({ success: ok });
});

apiRoutes.delete('/profiles/:id', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const profileId = Number(c.req.param('id'));
  const ok = await deleteProfile(profileId, user.id, c.env);
  if (ok) {
    await recordAuditLog(c.env, {
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'PROFILE_DELETE',
      target: `profile#${profileId}`,
      ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
    });
  }
  return c.json({ success: ok });
});

// ── Shares ───────────────────────────────────────────────────────────────────

apiRoutes.get('/profiles/:id/shares', async (c) => {
  const user = c.get('user')!;
  const profileId = Number(c.req.param('id'));
  return c.json(await getProfileShares(profileId, user.id, c.env));
});

apiRoutes.post('/profiles/:id/shares', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const profileId = Number(c.req.param('id'));
  const email = String(data.email || '').trim().toLowerCase();
  const canEdit = Boolean(data.can_edit);
  const canShare = Boolean(data.can_share);

  if (!isValidEmail(email)) {
    return c.json({ error: 'Invalid email address' }, 400);
  }
  if (email === user.email.toLowerCase()) {
    return c.json({ error: 'You cannot share with yourself' }, 400);
  }

  const ok = await shareProfile(profileId, user.id, email, canEdit, c.env, canShare);
  if (ok) {
    await recordAuditLog(c.env, {
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'SHARE_GRANT',
      target: `profile#${profileId} -> ${email}`,
      details: `${canEdit ? 'EDIT' : 'READ'}${canShare ? '+FWD' : ''}`,
      ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
    });
  }
  return c.json({ success: ok });
});

apiRoutes.delete('/profiles/:id/shares', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const profileId = Number(c.req.param('id'));
  const email = String(data.email || '').trim().toLowerCase();
  const ok = await unshareProfile(profileId, user.id, email, c.env);
  return c.json({ success: ok });
});

// ── Dynamic Custody Groups ───────────────────────────────────────────────────

apiRoutes.get('/groups', async (c) => {
  const user = c.get('user')!;
  return c.json(await listGroupsForUser(user.id, c.env));
});

apiRoutes.post('/groups', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const name = String(data.name || '').trim();
  const description = String(data.description || '').trim();
  const membersRaw = Array.isArray(data.members)
    ? (data.members as string[])
    : String(data.members || '')
        .split(/[\s,;]+/)
        .filter(Boolean);

  try {
    const id = await createGroup(user.id, name, description, membersRaw, c.env);
    return c.json({ success: true, id });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to create group' }, 400);
  }
});

apiRoutes.delete('/groups/:id', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const groupId = Number(c.req.param('id'));
  const ok = await deleteGroup(groupId, user.id, c.env);
  return c.json({ success: ok });
});

apiRoutes.post('/groups/:id/members', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const groupId = Number(c.req.param('id'));
  const emails = Array.isArray(data.emails)
    ? (data.emails as string[])
    : String(data.emails || data.email || '')
        .split(/[\s,;]+/)
        .filter(Boolean);

  try {
    const added = await addGroupMembers(groupId, user.id, emails, c.env);
    return c.json({ success: true, added });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to add members' }, 400);
  }
});

apiRoutes.delete('/groups/:id/members', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const groupId = Number(c.req.param('id'));
  const email = String(data.email || '').trim().toLowerCase();
  const ok = await removeGroupMember(groupId, user.id, email, c.env);
  return c.json({ success: ok });
});

apiRoutes.get('/profiles/:id/group-shares', async (c) => {
  const user = c.get('user')!;
  const profileId = Number(c.req.param('id'));
  return c.json(await getProfileGroupShares(profileId, user.id, c.env));
});

apiRoutes.post('/profiles/:id/group-shares', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const profileId = Number(c.req.param('id'));
  const groupId = Number(data.group_id || 0);
  const canEdit = Boolean(data.can_edit);
  const canShare = Boolean(data.can_share);
  if (groupId <= 0) {
    return c.json({ error: 'Please select a valid group' }, 400);
  }

  const ok = await shareProfileWithGroup(profileId, user.id, groupId, canEdit, c.env, canShare);
  if (ok) {
    await recordAuditLog(c.env, {
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'GROUP_SHARE',
      target: `profile#${profileId} -> group#${groupId}`,
      details: `${canEdit ? 'EDIT' : 'READ'}${canShare ? '+FWD' : ''}`,
      ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
    });
  }
  return c.json({ success: ok });
});

apiRoutes.delete('/profiles/:id/group-shares', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const profileId = Number(c.req.param('id'));
  const groupId = Number(data.group_id || 0);
  const ok = await unshareProfileFromGroup(profileId, user.id, groupId, c.env);
  return c.json({ success: ok });
});

// ── Export & Secret Generator ────────────────────────────────────────────────

function csvCell(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

apiRoutes.get('/export-profiles', async (c) => {
  const user = c.get('user')!;
  const rl = await checkRateLimit(c.env.DB, `export:uid_${user.id}`, 10, 60);
  if (!rl.allowed) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: `Too many requests. Please wait ${rl.retryAfter} seconds.` }, 429);
  }

  try {
    const rows = await exportProfilesForUser(user.id, c.env);
    await recordAuditLog(c.env, {
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'EXPORT_CSV',
      target: `${rows.length} profile(s)`,
      ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
    });
    const lines = ['profile,seed,title,algorithm,digits,period'];
    for (const r of rows) {
      lines.push(
        [r.profile, r.seed, r.title, r.algorithm, r.digits, r.period].map(csvCell).join(',')
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    return new Response(lines.join('\r\n') + '\r\n', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="totp-export-${today}.csv"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Export failed' }, 500);
  }
});

apiRoutes.get('/generate-secret', async (c) => {
  const user = c.get('user')!;
  const rl = await checkRateLimit(c.env.DB, `gensec:uid_${user.id}`, 60, 60);
  if (!rl.allowed) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: `Too many requests. Please wait ${rl.retryAfter} seconds.` }, 429);
  }
  return c.json({ secret: generateSecret() });
});

// ── Whitelist Management (Admin Only) ────────────────────────────────────────

apiRoutes.get('/whitelist', async (c) => {
  const user = c.get('user')!;
  if (!user.is_admin) {
    return c.json({ error: 'Access denied: Only Administrators may manage the directory.' }, 403);
  }
  const [usersRes, wlRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT u.id AS user_id, u.email, u.name, u.avatar_url, u.created_at,
              w.id AS whitelist_id, COALESCE(w.is_admin, 0) AS is_admin, w.role_label
       FROM users u
       LEFT JOIN whitelist_users w ON LOWER(w.email) = LOWER(u.email)
       ORDER BY COALESCE(w.is_admin, 0) DESC, u.created_at DESC`
    ).all<{
      user_id: number;
      email: string;
      name: string | null;
      avatar_url: string | null;
      created_at: string;
      whitelist_id: number | null;
      is_admin: number;
      role_label: string | null;
    }>(),
    c.env.DB.prepare(
      'SELECT id, email, name, role_label, is_admin, created_by_email, created_at FROM whitelist_users ORDER BY is_admin DESC, created_at ASC'
    ).all<{
      id: number;
      email: string;
      name: string;
      role_label: string;
      is_admin: number;
      created_by_email: string | null;
      created_at: string;
    }>(),
  ]);

  const seenEmails = new Set<string>();
  const combined: Array<Record<string, unknown>> = [];

  for (const u of usersRes.results ?? []) {
    const emailLower = u.email.toLowerCase();
    seenEmails.add(emailLower);
    combined.push({
      id: u.whitelist_id,
      user_id: u.user_id,
      email: u.email,
      name: u.name || '',
      avatar_url: u.avatar_url || null,
      role_label: u.role_label || (u.is_admin ? 'Administrator' : 'Member'),
      is_admin: Number(u.is_admin || 0),
      registered: 1,
      created_at: u.created_at,
    });
  }

  for (const w of wlRes.results ?? []) {
    const emailLower = w.email.toLowerCase();
    if (seenEmails.has(emailLower)) continue;
    combined.push({
      id: w.id,
      user_id: null,
      email: w.email,
      name: w.name || '',
      avatar_url: null,
      role_label: w.role_label || (w.is_admin ? 'Administrator' : 'Member'),
      is_admin: Number(w.is_admin || 0),
      registered: 0,
      created_at: w.created_at,
    });
  }

  return c.json(combined);
});

apiRoutes.post('/whitelist', async (c) => {
  const user = c.get('user')!;
  if (!user.is_admin) {
    return c.json({ error: 'Access denied: Only Administrators may manage the whitelist.' }, 403);
  }

  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const email = String(data.email || '').trim().toLowerCase();
  const name = String(data.name || '').trim();
  const isAdmin = data.is_admin ? 1 : 0;
  const role = String(data.role_label || (isAdmin ? 'Administrator' : 'Standard User')).trim();

  if (!isValidEmail(email)) {
    return c.json({ error: 'Invalid email format' }, 400);
  }

  try {
    const res = await c.env.DB.prepare(
      `INSERT INTO whitelist_users (email, name, role_label, is_admin, created_by_email)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name, role_label = excluded.role_label, is_admin = excluded.is_admin`
    )
      .bind(email, name, role, isAdmin, user.email)
      .run();
    return c.json({ success: true, id: Number(res.meta.last_row_id) });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed to save whitelist entry' }, 400);
  }
});

apiRoutes.delete('/whitelist/:id', async (c) => {
  const user = c.get('user')!;
  if (!user.is_admin) {
    return c.json({ error: 'Access denied: Only Administrators may remove whitelist accounts.' }, 403);
  }

  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const id = Number(c.req.param('id'));
  const target = await c.env.DB.prepare('SELECT email FROM whitelist_users WHERE id = ?')
    .bind(id)
    .first<{ email: string }>();

  if (target && target.email.toLowerCase() === user.email.toLowerCase()) {
    return c.json({ error: 'You cannot remove your own account from the whitelist' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM whitelist_users WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ── Access & Sharing Manager (Admin Only) ────────────────────────────────────

apiRoutes.use('/access/*', async (c, next) => {
  const user = c.get('user')!;
  if (!user.is_admin) {
    return c.json({ error: 'Access denied: Only Administrators may manage access rights.' }, 403);
  }
  await next();
});

apiRoutes.get('/access/metrics', async (c) => {
  return c.json(await getAccessOverviewMetrics(c.env));
});

apiRoutes.get('/access/matrix', async (c) => {
  const email = (c.req.query('email') || '').trim().toLowerCase();
  if (!email) return c.json({ error: 'The email parameter is required' }, 400);
  return c.json(await getUserAccessMatrix(email, c.env));
});

apiRoutes.get('/access/token-matrix', async (c) => {
  const profileId = Number(c.req.query('profile_id') || 0);
  if (profileId <= 0) return c.json({ error: 'The profile_id parameter is required' }, 400);
  try {
    return c.json(await getTokenAccessMatrix(profileId, c.env));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Not found' }, 400);
  }
});

apiRoutes.post('/access/sync-token', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) return c.json({ error: 'Invalid CSRF token' }, 403);

  const profileId = Number(data.profile_id || 0);
  const shares = Array.isArray(data.shares) ? data.shares : [];
  if (profileId <= 0) return c.json({ error: 'Invalid profile_id parameter' }, 400);

  try {
    return c.json(await syncTokenShares(user.id, profileId, shares, c.env));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Sync failed' }, 400);
  }
});

apiRoutes.post('/access/sync', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) return c.json({ error: 'Invalid CSRF token' }, 403);

  const email = String(data.email || '').trim().toLowerCase();
  const shares = Array.isArray(data.shares) ? data.shares : [];
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email format' }, 400);

  try {
    return c.json(await syncUserShares(user.id, email, shares, c.env));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Sync failed' }, 400);
  }
});

apiRoutes.post('/access/revoke-all', async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) return c.json({ error: 'Invalid CSRF token' }, 403);

  const email = String(data.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email format' }, 400);

  const count = await revokeAllUserShares(email, c.env);
  return c.json({ success: true, revoked_count: count, email });
});

apiRoutes.get('/access/shares', async (c) => {
  return c.json(await getAllActiveShares(c.env));
});

apiRoutes.get('/access/group-shares', async (c) => {
  return c.json(await getAllActiveGroupShares(c.env));
});

apiRoutes.post('/access/revoke-group-share', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) return c.json({ error: 'Invalid CSRF token' }, 403);
  const shareId = Number(data.share_id || 0);
  const ok = await adminRevokeGroupShare(shareId, c.env);
  if (ok) {
    await recordAuditLog(c.env, {
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'ADMIN_REVOKE_GROUP_SHARE',
      target: `group_share#${shareId}`,
      ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
    });
  }
  return c.json({ success: ok });
});

apiRoutes.get('/audit-logs', async (c) => {
  const user = c.get('user')!;
  if (!user.is_admin) {
    return c.json({ error: 'Access denied: Only Administrators may view audit logs.' }, 403);
  }
  const q = c.req.query('q') || '';
  const limit = Number(c.req.query('limit') || 100);
  return c.json(await listAuditLogs(c.env, limit, q));
});

apiRoutes.post('/admin/toggle-admin', async (c) => {
  const user = c.get('user')!;
  if (!user.is_admin) return c.json({ error: 'Access denied' }, 403);
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) return c.json({ error: 'Invalid CSRF token' }, 403);

  const email = String(data.email || '').trim().toLowerCase();
  const name = String(data.name || '').trim();
  const makeAdmin = data.is_admin ? 1 : 0;
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email' }, 400);
  if (email === user.email.toLowerCase() && !makeAdmin) {
    return c.json({ error: 'You cannot demote your own administrator account.' }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO whitelist_users (email, name, role_label, is_admin, created_by_email)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET is_admin = excluded.is_admin, role_label = excluded.role_label`
  )
    .bind(email, name, makeAdmin ? 'Administrator' : 'Member', makeAdmin, user.email)
    .run();

  await recordAuditLog(c.env, {
    actorUserId: user.id,
    actorEmail: user.email,
    action: makeAdmin ? 'ROLE_PROMOTE_ADMIN' : 'ROLE_DEMOTE_MEMBER',
    target: email,
    ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
  });
  return c.json({ success: true });
});

apiRoutes.post('/admin/force-logout', async (c) => {
  const user = c.get('user')!;
  if (!user.is_admin) return c.json({ error: 'Access denied' }, 403);
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) return c.json({ error: 'Invalid CSRF token' }, 403);

  const email = String(data.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email' }, 400);
  const revoked = await adminForceLogoutUser(email, c.env);
  await recordAuditLog(c.env, {
    actorUserId: user.id,
    actorEmail: user.email,
    action: 'ADMIN_FORCE_LOGOUT',
    target: email,
    details: `${revoked} session(s) terminated`,
    ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
  });
  return c.json({ success: true, revoked });
});

apiRoutes.post('/admin/offboard', async (c) => {
  const user = c.get('user')!;
  if (!user.is_admin) return c.json({ error: 'Access denied' }, 403);
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) return c.json({ error: 'Invalid CSRF token' }, 403);

  const email = String(data.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return c.json({ error: 'Invalid email' }, 400);
  if (email === user.email.toLowerCase()) {
    return c.json({ error: 'You cannot offboard your own account.' }, 400);
  }

  const summary = await adminOffboardUser(email, c.env);
  await recordAuditLog(c.env, {
    actorUserId: user.id,
    actorEmail: user.email,
    action: 'ADMIN_OFFBOARD_USER',
    target: email,
    details: JSON.stringify(summary),
    ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
  });
  return c.json({ success: true, ...summary });
});

apiRoutes.post('/access/bulk-revoke', async (c) => {
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) return c.json({ error: 'Invalid CSRF token' }, 403);

  const ids = Array.isArray(data.share_ids) ? (data.share_ids as number[]) : [];
  const count = await bulkRevokeShares(ids, c.env);
  return c.json({ success: true, revoked_count: count });
});

apiRoutes.get('/access/all-tokens', async (c) => {
  return c.json(await getAllProfilesForAdmin(c.env));
});

apiRoutes.post('/access/bulk-multi-share', async (c) => {
  const user = c.get('user')!;
  const data = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!(await verifyCsrf(c, data))) return c.json({ error: 'Invalid CSRF token' }, 403);

  const profileIds = Array.isArray(data.profile_ids) ? (data.profile_ids as number[]) : [];
  const emails = Array.isArray(data.emails) ? (data.emails as string[]) : [];
  const action = String(data.action || 'grant');
  const canEdit = Boolean(data.can_edit);

  try {
    return c.json(await bulkMultiShare(user.id, profileIds, emails, action, canEdit, c.env));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Bulk multi-share failed' }, 400);
  }
});
