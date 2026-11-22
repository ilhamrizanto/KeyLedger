import { Env, OtpProfile } from '../types';
import { decryptSecret, encryptSecret } from '../lib/crypto';
import { generateTOTP, secondsRemaining, totpProgress } from '../lib/totp';
import { isValidEmail } from '../lib/html';

export interface ProfileInput {
  name: string;
  issuer?: string;
  secret: string;
  algorithm?: string;
  digits?: number;
  period?: number;
  color?: string;
  icon?: string;
  hide_code?: number | boolean;
}

export async function createProfile(userId: number, data: ProfileInput, env: Env): Promise<number> {
  const secret = String(data.secret || '').replace(/\s+/g, '').toUpperCase();
  if (!data.name?.trim() || !secret) {
    throw new Error('Name and secret are required.');
  }

  const encrypted = await encryptSecret(secret, env.ENCRYPTION_KEY, env.APP_ENV);
  const res = await env.DB.prepare(
    `INSERT INTO otp_profiles (user_id, name, issuer, secret_encrypted, algorithm, digits, period, color, icon, hide_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      userId,
      data.name.trim(),
      (data.issuer ?? '').trim(),
      encrypted,
      data.algorithm || 'SHA1',
      Number(data.digits ?? 6),
      Number(data.period ?? 30),
      data.color || '#10b981',
      data.icon || 'fa-shield-halved',
      data.hide_code ? 1 : 0
    )
    .run();

  return Number(res.meta.last_row_id);
}

export async function createProfileBatch(userId: number, items: ProfileInput[], env: Env): Promise<number> {
  if (!items.length) return 0;

  const stmt = env.DB.prepare(
    `INSERT INTO otp_profiles (user_id, name, issuer, secret_encrypted, algorithm, digits, period, color, icon, hide_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const batch: D1PreparedStatement[] = [];
  for (const data of items) {
    if (!data.name || !data.secret) continue;
    const secret = String(data.secret).replace(/\s+/g, '').toUpperCase();
    const encrypted = await encryptSecret(secret, env.ENCRYPTION_KEY, env.APP_ENV);
    batch.push(
      stmt.bind(
        userId,
        String(data.name).trim(),
        String(data.issuer ?? '').trim(),
        encrypted,
        data.algorithm || 'SHA1',
        Number(data.digits ?? 6),
        Number(data.period ?? 30),
        data.color || '#10b981',
        data.icon || 'fa-shield-halved',
        data.hide_code ? 1 : 0
      )
    );
  }

  if (batch.length === 0) return 0;
  await env.DB.batch(batch);
  return batch.length;
}

async function canEditProfile(profileId: number, userId: number, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS ok FROM otp_profiles WHERE id = ? AND user_id = ?
     UNION
     SELECT 1 AS ok FROM profile_shares WHERE profile_id = ? AND shared_with_user_id = ? AND can_edit = 1
     LIMIT 1`
  )
    .bind(profileId, userId, profileId, userId)
    .first<{ ok: number }>();
  return Boolean(row);
}

export async function updateProfile(
  profileId: number,
  userId: number,
  data: Partial<ProfileInput>,
  env: Env
): Promise<boolean> {
  if (!(await canEditProfile(profileId, userId, env))) return false;

  const fields: string[] = [];
  const params: unknown[] = [];

  for (const f of ['name', 'issuer', 'algorithm', 'color', 'icon'] as const) {
    if (data[f] !== undefined) {
      fields.push(`${f} = ?`);
      params.push(data[f]);
    }
  }
  for (const f of ['digits', 'period'] as const) {
    if (data[f] !== undefined) {
      fields.push(`${f} = ?`);
      params.push(Number(data[f]));
    }
  }
  if (data.hide_code !== undefined) {
    fields.push('hide_code = ?');
    params.push(data.hide_code ? 1 : 0);
  }
  if (data.secret) {
    const cleanSecret = String(data.secret).replace(/\s+/g, '').toUpperCase();
    fields.push('secret_encrypted = ?');
    params.push(await encryptSecret(cleanSecret, env.ENCRYPTION_KEY, env.APP_ENV));
  }

  if (fields.length === 0) return true;
  fields.push("updated_at = datetime('now')");
  params.push(profileId);

  await env.DB.prepare(`UPDATE otp_profiles SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();
  return true;
}

export async function deleteProfile(profileId: number, userId: number, env: Env): Promise<boolean> {
  const existing = await env.DB.prepare('SELECT id FROM otp_profiles WHERE id = ? AND user_id = ?')
    .bind(profileId, userId)
    .first<{ id: number }>();
  if (!existing) return false;

  await env.DB.batch([
    env.DB.prepare('DELETE FROM profile_shares WHERE profile_id = ?').bind(profileId),
    env.DB.prepare('DELETE FROM otp_profiles WHERE id = ? AND user_id = ?').bind(profileId, userId),
  ]);
  return true;
}

export async function getProfile(profileId: number, userId: number, env: Env): Promise<OtpProfile | null> {
  return env.DB.prepare(
    `SELECT p.*, u.name AS owner_name, u.email AS owner_email,
            CASE WHEN p.user_id = ? THEN 1 ELSE 0 END AS is_owner,
            COALESCE(s.can_edit, CASE WHEN p.user_id = ? THEN 1 ELSE 0 END) AS can_edit
     FROM otp_profiles p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN profile_shares s ON s.profile_id = p.id AND s.shared_with_user_id = ?
     WHERE p.id = ? AND (p.user_id = ? OR s.shared_with_user_id = ?)
     LIMIT 1`
  )
    .bind(userId, userId, userId, profileId, userId, userId)
    .first<OtpProfile>();
}

export async function listProfilesForUser(userId: number, env: Env): Promise<OtpProfile[]> {
  const res = await env.DB.prepare(
    `SELECT p.*, u.name AS owner_name, u.email AS owner_email,
            CASE WHEN p.user_id = ? THEN 1 ELSE 0 END AS is_owner,
            COALESCE(s.can_edit, CASE WHEN p.user_id = ? THEN 1 ELSE 0 END) AS can_edit
     FROM otp_profiles p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN profile_shares s ON s.profile_id = p.id AND s.shared_with_user_id = ?
     WHERE p.user_id = ? OR s.shared_with_user_id = ?
     ORDER BY (p.user_id = ?) DESC, p.name ASC`
  )
    .bind(userId, userId, userId, userId, userId, userId)
    .all<OtpProfile>();
  return res.results ?? [];
}

export async function generateProfileOTP(profileId: number, userId: number, env: Env) {
  const profile = await getProfile(profileId, userId, env);
  if (!profile) {
    throw new Error('Profile not found or access denied.');
  }

  const secret = await decryptSecret(profile.secret_encrypted, env.ENCRYPTION_KEY, env.APP_ENV);
  const now = Math.floor(Date.now() / 1000);
  const period = Number(profile.period || 30);
  const digits = Number(profile.digits || 6);

  return {
    code: await generateTOTP(secret, profile.algorithm, digits, period, now),
    remaining: secondsRemaining(period, now),
    progress: totpProgress(period, now),
    period,
    digits,
    algorithm: profile.algorithm,
    hide_code: Number(profile.hide_code || 0),
  };
}

export async function shareProfile(
  profileId: number,
  ownerUserId: number,
  email: string,
  canEdit: boolean,
  env: Env
): Promise<boolean> {
  const owned = await env.DB.prepare('SELECT id FROM otp_profiles WHERE id = ? AND user_id = ?')
    .bind(profileId, ownerUserId)
    .first<{ id: number }>();
  if (!owned) return false;

  const targetUser = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ?')
    .bind(email.toLowerCase())
    .first<{ id: number }>();

  await env.DB.prepare(
    `INSERT INTO profile_shares (profile_id, shared_by_user_id, shared_with_email, shared_with_user_id, can_edit)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(profile_id, shared_with_email)
     DO UPDATE SET shared_with_user_id = excluded.shared_with_user_id, can_edit = excluded.can_edit`
  )
    .bind(profileId, ownerUserId, email.toLowerCase(), targetUser?.id ?? null, canEdit ? 1 : 0)
    .run();

  return true;
}

export async function unshareProfile(
  profileId: number,
  ownerUserId: number,
  email: string,
  env: Env
): Promise<boolean> {
  const owned = await env.DB.prepare('SELECT id FROM otp_profiles WHERE id = ? AND user_id = ?')
    .bind(profileId, ownerUserId)
    .first<{ id: number }>();
  if (!owned) return false;

  const res = await env.DB.prepare(
    'DELETE FROM profile_shares WHERE profile_id = ? AND LOWER(shared_with_email) = ?'
  )
    .bind(profileId, email.toLowerCase())
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function getProfileShares(profileId: number, ownerUserId: number, env: Env) {
  const res = await env.DB.prepare(
    `SELECT ps.*, u.name AS user_name, u.avatar_url
     FROM profile_shares ps
     LEFT JOIN users u ON u.id = ps.shared_with_user_id
     WHERE ps.profile_id = ? AND ps.shared_by_user_id = ?
     ORDER BY ps.created_at DESC`
  )
    .bind(profileId, ownerUserId)
    .all();
  return res.results ?? [];
}

export async function exportProfilesForUser(userId: number, env: Env) {
  const res = await env.DB.prepare(
    `SELECT p.id, p.name, p.secret_encrypted, p.algorithm, p.digits, p.period
     FROM otp_profiles p
     LEFT JOIN profile_shares s ON s.profile_id = p.id AND s.shared_with_user_id = ?
     WHERE p.user_id = ? OR (s.shared_with_user_id = ? AND s.can_edit = 1)
     ORDER BY p.id ASC`
  )
    .bind(userId, userId, userId)
    .all<OtpProfile>();

  const rows = res.results ?? [];
  const out = [];
  for (const row of rows) {
    out.push({
      profile: row.id,
      seed: await decryptSecret(row.secret_encrypted, env.ENCRYPTION_KEY, env.APP_ENV),
      title: row.name,
      algorithm: row.algorithm,
      digits: Number(row.digits),
      period: Number(row.period),
    });
  }
  return out;
}

// ── Admin Access & Sharing Manager ──────────────────────────────────────────

export async function getAccessOverviewMetrics(env: Env) {
  const [collab, shares, tokens, users] = await Promise.all([
    env.DB.prepare('SELECT COUNT(DISTINCT LOWER(shared_with_email)) AS cnt FROM profile_shares').first<{ cnt: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM profile_shares').first<{ cnt: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM otp_profiles').first<{ cnt: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS cnt FROM whitelist_users').first<{ cnt: number }>(),
  ]);

  return {
    total_collaborators: collab?.cnt ?? 0,
    total_shares: shares?.cnt ?? 0,
    total_tokens: tokens?.cnt ?? 0,
    total_users: users?.cnt ?? 0,
  };
}

export async function getUserAccessMatrix(targetEmailInput: string, env: Env) {
  const targetEmail = targetEmailInput.trim().toLowerCase();

  const [profilesRes, sharesRes] = await Promise.all([
    env.DB.prepare(
      `SELECT p.id, p.name, p.issuer, p.icon, p.color, p.algorithm, p.digits, p.period, p.user_id,
              u.name AS owner_name, u.email AS owner_email
       FROM otp_profiles p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.issuer ASC, p.name ASC`
    ).all<{
      id: number;
      name: string;
      issuer: string;
      icon: string;
      color: string;
      owner_name: string | null;
      owner_email: string;
    }>(),
    env.DB.prepare(
      'SELECT profile_id, can_edit, id AS share_id, created_at FROM profile_shares WHERE LOWER(shared_with_email) = ?'
    )
      .bind(targetEmail)
      .all<{ profile_id: number; can_edit: number; share_id: number; created_at: string }>(),
  ]);

  const sharesMap = new Map((sharesRes.results ?? []).map((s) => [s.profile_id, s]));

  return (profilesRes.results ?? []).map((p) => {
    const isOwner = p.owner_email.toLowerCase() === targetEmail;
    const share = sharesMap.get(p.id) ?? null;
    return {
      profile_id: p.id,
      name: p.name,
      issuer: p.issuer,
      icon: p.icon,
      color: p.color,
      owner_name: p.owner_name,
      owner_email: p.owner_email,
      is_owner: isOwner,
      is_shared: share !== null,
      can_edit: isOwner ? 1 : share ? Number(share.can_edit) : 0,
      share_id: share ? share.share_id : null,
      created_at: share ? share.created_at : null,
    };
  });
}

export async function getTokenAccessMatrix(profileId: number, env: Env) {
  const profile = await env.DB.prepare(
    `SELECT p.id, p.name, p.issuer, p.icon, p.color, p.algorithm, p.digits, p.period, p.user_id,
            u.name AS owner_name, u.email AS owner_email
     FROM otp_profiles p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = ?`
  )
    .bind(profileId)
    .first<{
      id: number;
      name: string;
      issuer: string;
      icon: string;
      color: string;
      owner_name: string | null;
      owner_email: string;
    }>();

  if (!profile) throw new Error('Token not found.');

  const [usersRes, sharesRes] = await Promise.all([
    env.DB.prepare(
      `SELECT w.email, w.name, w.role_label, w.is_admin, u.id AS user_id, u.avatar_url
       FROM whitelist_users w
       LEFT JOIN users u ON LOWER(u.email) = LOWER(w.email)
       ORDER BY w.name ASC, w.email ASC`
    ).all<{
      email: string;
      name: string;
      role_label: string;
      is_admin: number;
      user_id: number | null;
      avatar_url: string | null;
    }>(),
    env.DB.prepare('SELECT shared_with_email, can_edit, id AS share_id, created_at FROM profile_shares WHERE profile_id = ?')
      .bind(profileId)
      .all<{ shared_with_email: string; can_edit: number; share_id: number; created_at: string }>(),
  ]);

  const sharesMap = new Map(
    (sharesRes.results ?? []).map((s) => [s.shared_with_email.toLowerCase(), s])
  );
  const ownerEmail = profile.owner_email.toLowerCase();

  const matrixUsers = (usersRes.results ?? []).map((u) => {
    const email = u.email.toLowerCase();
    const isOwner = email === ownerEmail;
    const share = sharesMap.get(email) ?? null;
    return {
      email: u.email,
      name: u.name || u.email,
      role: u.is_admin ? 'admin' : 'member',
      role_label: u.role_label || 'Member',
      user_id: u.user_id ?? null,
      avatar_url: u.avatar_url ?? null,
      is_owner: isOwner,
      has_access: isOwner || share !== null,
      can_edit: isOwner ? true : share ? Boolean(share.can_edit) : false,
      share_id: share ? share.share_id : null,
      created_at: share ? share.created_at : null,
    };
  });

  return { profile, users: matrixUsers };
}

export async function syncTokenShares(
  adminUserId: number,
  profileId: number,
  shares: Array<{ email?: string; enabled?: boolean; can_edit?: boolean }>,
  env: Env
) {
  const prof = await env.DB.prepare(
    'SELECT id, (SELECT email FROM users WHERE id = otp_profiles.user_id) AS owner_email FROM otp_profiles WHERE id = ?'
  )
    .bind(profileId)
    .first<{ id: number; owner_email: string | null }>();
  if (!prof) throw new Error('Token not found.');
  const ownerEmail = (prof.owner_email ?? '').toLowerCase();

  const usersRes = await env.DB.prepare('SELECT id, LOWER(email) AS email FROM users').all<{ id: number; email: string }>();
  const userMap = new Map((usersRes.results ?? []).map((u) => [u.email, u.id]));

  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const item of shares) {
    const email = (item.email ?? '').trim().toLowerCase();
    if (!email || !isValidEmail(email) || email === ownerEmail) continue;

    if (item.enabled) {
      const existing = await env.DB.prepare(
        'SELECT id FROM profile_shares WHERE profile_id = ? AND LOWER(shared_with_email) = ?'
      )
        .bind(profileId, email)
        .first<{ id: number }>();

      await env.DB.prepare(
        `INSERT INTO profile_shares (profile_id, shared_by_user_id, shared_with_email, shared_with_user_id, can_edit)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, shared_with_email)
         DO UPDATE SET shared_with_user_id = excluded.shared_with_user_id, can_edit = excluded.can_edit`
      )
        .bind(profileId, adminUserId, email, userMap.get(email) ?? null, item.can_edit ? 1 : 0)
        .run();

      if (existing) updated++;
      else added++;
    } else {
      const del = await env.DB.prepare('DELETE FROM profile_shares WHERE profile_id = ? AND LOWER(shared_with_email) = ?')
        .bind(profileId, email)
        .run();
      if ((del.meta.changes ?? 0) > 0) removed++;
    }
  }

  return { success: true, profile_id: profileId, added, updated, removed };
}

export async function syncUserShares(
  adminUserId: number,
  targetEmailInput: string,
  shares: Array<{ profile_id?: number; enabled?: boolean; can_edit?: boolean }>,
  env: Env
) {
  const targetEmail = targetEmailInput.trim().toLowerCase();
  if (!isValidEmail(targetEmail)) throw new Error('Invalid email format.');

  const targetUser = await env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ?')
    .bind(targetEmail)
    .first<{ id: number }>();
  const targetUserId = targetUser?.id ?? null;

  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const item of shares) {
    const profileId = Number(item.profile_id ?? 0);
    if (profileId <= 0) continue;

    const prof = await env.DB.prepare(
      'SELECT user_id, (SELECT email FROM users WHERE id = otp_profiles.user_id) AS owner_email FROM otp_profiles WHERE id = ?'
    )
      .bind(profileId)
      .first<{ user_id: number; owner_email: string | null }>();
    if (!prof || (prof.owner_email ?? '').toLowerCase() === targetEmail) continue;

    if (item.enabled) {
      const existing = await env.DB.prepare(
        'SELECT id FROM profile_shares WHERE profile_id = ? AND LOWER(shared_with_email) = ?'
      )
        .bind(profileId, targetEmail)
        .first<{ id: number }>();

      await env.DB.prepare(
        `INSERT INTO profile_shares (profile_id, shared_by_user_id, shared_with_email, shared_with_user_id, can_edit)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, shared_with_email)
         DO UPDATE SET shared_with_user_id = excluded.shared_with_user_id, can_edit = excluded.can_edit`
      )
        .bind(profileId, adminUserId, targetEmail, targetUserId, item.can_edit ? 1 : 0)
        .run();

      if (existing) updated++;
      else added++;
    } else {
      const del = await env.DB.prepare('DELETE FROM profile_shares WHERE profile_id = ? AND LOWER(shared_with_email) = ?')
        .bind(profileId, targetEmail)
        .run();
      if ((del.meta.changes ?? 0) > 0) removed++;
    }
  }

  return { success: true, target_email: targetEmail, added, updated, removed };
}

export async function revokeAllUserShares(targetEmail: string, env: Env): Promise<number> {
  const res = await env.DB.prepare('DELETE FROM profile_shares WHERE LOWER(shared_with_email) = ?')
    .bind(targetEmail.trim().toLowerCase())
    .run();
  return res.meta.changes ?? 0;
}

export async function getAllActiveShares(env: Env) {
  const res = await env.DB.prepare(
    `SELECT ps.id AS share_id, ps.profile_id, ps.shared_with_email, ps.can_edit, ps.created_at,
            p.name AS profile_name, p.issuer, p.icon, p.color,
            u_owner.name AS owner_name, u_owner.email AS owner_email,
            COALESCE(u_target.name, w.name, 'User') AS target_name
     FROM profile_shares ps
     JOIN otp_profiles p ON p.id = ps.profile_id
     JOIN users u_owner ON u_owner.id = p.user_id
     LEFT JOIN users u_target ON u_target.id = ps.shared_with_user_id
     LEFT JOIN whitelist_users w ON LOWER(w.email) = LOWER(ps.shared_with_email)
     ORDER BY ps.created_at DESC`
  ).all();
  return res.results ?? [];
}

export async function bulkRevokeShares(shareIds: number[], env: Env): Promise<number> {
  const ids = shareIds.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return 0;

  const placeholders = ids.map(() => '?').join(',');
  const res = await env.DB.prepare(`DELETE FROM profile_shares WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run();
  return res.meta.changes ?? 0;
}

export async function getAllProfilesForAdmin(env: Env) {
  const res = await env.DB.prepare(
    `SELECT p.id, p.name, p.issuer, p.icon, p.color, p.algorithm, p.digits, p.period,
            u.name AS owner_name, u.email AS owner_email
     FROM otp_profiles p
     JOIN users u ON u.id = p.user_id
     ORDER BY p.issuer ASC, p.name ASC`
  ).all();
  return res.results ?? [];
}

export async function bulkMultiShare(
  adminUserId: number,
  profileIdsRaw: number[],
  targetEmailsRaw: string[],
  action: string,
  canEdit: boolean,
  env: Env
) {
  const profileIds = [...new Set(profileIdsRaw.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (profileIds.length === 0) throw new Error('Select at least one token.');

  const targetEmails = [
    ...new Set(targetEmailsRaw.map((e) => String(e).trim().toLowerCase()).filter(isValidEmail)),
  ];
  if (targetEmails.length === 0) throw new Error('Select at least one target user account.');

  const normalizedAction = action === 'revoke' ? 'revoke' : 'grant';

  const pPlaceholders = profileIds.map(() => '?').join(',');
  const ePlaceholders = targetEmails.map(() => '?').join(',');

  const ownersRes = await env.DB.prepare(
    `SELECT p.id, LOWER(u.email) AS owner_email
     FROM otp_profiles p JOIN users u ON u.id = p.user_id
     WHERE p.id IN (${pPlaceholders})`
  )
    .bind(...profileIds)
    .all<{ id: number; owner_email: string }>();
  const ownerMap = new Map((ownersRes.results ?? []).map((r) => [r.id, r.owner_email]));

  const usersRes = await env.DB.prepare(
    `SELECT id, LOWER(email) AS email FROM users WHERE LOWER(email) IN (${ePlaceholders})`
  )
    .bind(...targetEmails)
    .all<{ id: number; email: string }>();
  const userMap = new Map((usersRes.results ?? []).map((r) => [r.email, r.id]));

  let added = 0;
  let updated = 0;
  let removed = 0;
  let skippedSelf = 0;

  if (normalizedAction === 'grant') {
    for (const email of targetEmails) {
      const targetUserId = userMap.get(email) ?? null;
      for (const pid of profileIds) {
        if (ownerMap.get(pid) === email) {
          skippedSelf++;
          continue;
        }
        const existing = await env.DB.prepare(
          'SELECT id FROM profile_shares WHERE profile_id = ? AND LOWER(shared_with_email) = ?'
        )
          .bind(pid, email)
          .first<{ id: number }>();

        await env.DB.prepare(
          `INSERT INTO profile_shares (profile_id, shared_by_user_id, shared_with_email, shared_with_user_id, can_edit)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(profile_id, shared_with_email)
           DO UPDATE SET shared_with_user_id = excluded.shared_with_user_id, can_edit = excluded.can_edit`
        )
          .bind(pid, adminUserId, email, targetUserId, canEdit ? 1 : 0)
          .run();

        if (existing) updated++;
        else added++;
      }
    }
  } else {
    const del = await env.DB.prepare(
      `DELETE FROM profile_shares WHERE profile_id IN (${pPlaceholders}) AND LOWER(shared_with_email) IN (${ePlaceholders})`
    )
      .bind(...profileIds, ...targetEmails)
      .run();
    removed = del.meta.changes ?? 0;
  }

  return {
    success: true,
    action: normalizedAction,
    tokens_count: profileIds.length,
    users_count: targetEmails.length,
    added,
    updated,
    removed,
    skipped_self: skippedSelf,
  };
}
