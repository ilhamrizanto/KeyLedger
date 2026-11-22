import { Env } from '../types';
import { isValidEmail } from '../lib/html';

export interface GroupMemberItem {
  id: number;
  member_email: string;
  member_user_id: number | null;
  user_name: string | null;
  avatar_url: string | null;
}

export interface GroupRecord {
  id: number;
  owner_user_id: number;
  owner_email: string;
  name: string;
  description: string;
  is_owner: boolean;
  created_at: string;
  members: GroupMemberItem[];
}

export async function listGroupsForUser(userId: number, env: Env): Promise<GroupRecord[]> {
  const groupsRes = await env.DB.prepare(
    `SELECT DISTINCT g.id, g.owner_user_id, u.email AS owner_email, g.name, g.description, g.created_at,
            CASE WHEN g.owner_user_id = ? THEN 1 ELSE 0 END AS is_owner
     FROM groups g
     JOIN users u ON u.id = g.owner_user_id
     LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.member_user_id = ?
     WHERE g.owner_user_id = ? OR gm.member_user_id = ?
     ORDER BY is_owner DESC, g.name ASC`
  )
    .bind(userId, userId, userId, userId)
    .all<{
      id: number;
      owner_user_id: number;
      owner_email: string;
      name: string;
      description: string;
      created_at: string;
      is_owner: number;
    }>();

  const rows = groupsRes.results ?? [];
  if (rows.length === 0) return [];

  const groupIds = rows.map((r) => r.id);
  const placeholders = groupIds.map(() => '?').join(',');
  const membersRes = await env.DB.prepare(
    `SELECT gm.id, gm.group_id, gm.member_email, gm.member_user_id, u.name AS user_name, u.avatar_url
     FROM group_members gm
     LEFT JOIN users u ON u.id = gm.member_user_id
     WHERE gm.group_id IN (${placeholders})
     ORDER BY gm.member_email ASC`
  )
    .bind(...groupIds)
    .all<GroupMemberItem & { group_id: number }>();

  const membersByGroup = new Map<number, GroupMemberItem[]>();
  for (const m of membersRes.results ?? []) {
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push({
      id: m.id,
      member_email: m.member_email,
      member_user_id: m.member_user_id,
      user_name: m.user_name,
      avatar_url: m.avatar_url,
    });
    membersByGroup.set(m.group_id, list);
  }

  return rows.map((g) => ({
    id: g.id,
    owner_user_id: g.owner_user_id,
    owner_email: g.owner_email,
    name: g.name,
    description: g.description || '',
    is_owner: Boolean(g.is_owner),
    created_at: g.created_at,
    members: membersByGroup.get(g.id) ?? [],
  }));
}

export async function createGroup(
  ownerUserId: number,
  name: string,
  description: string,
  memberEmails: string[],
  env: Env
): Promise<number> {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Group name is required.');
  }

  const ins = await env.DB.prepare(
    'INSERT INTO groups (owner_user_id, name, description) VALUES (?, ?, ?)'
  )
    .bind(ownerUserId, cleanName, description.trim())
    .run();

  const groupId = Number(ins.meta.last_row_id);
  if (memberEmails.length > 0) {
    await addGroupMembers(groupId, ownerUserId, memberEmails, env);
  }
  return groupId;
}

export async function addGroupMembers(
  groupId: number,
  ownerUserId: number,
  rawEmails: string[],
  env: Env
): Promise<number> {
  const owned = await env.DB.prepare('SELECT id FROM groups WHERE id = ? AND owner_user_id = ?')
    .bind(groupId, ownerUserId)
    .first<{ id: number }>();
  if (!owned) {
    throw new Error('Group not found or permission denied.');
  }

  const emails = [
    ...new Set(rawEmails.map((e) => String(e).trim().toLowerCase()).filter(isValidEmail)),
  ];
  if (emails.length === 0) return 0;

  const placeholders = emails.map(() => '?').join(',');
  const usersRes = await env.DB.prepare(
    `SELECT id, LOWER(email) AS email FROM users WHERE LOWER(email) IN (${placeholders})`
  )
    .bind(...emails)
    .all<{ id: number; email: string }>();
  const userMap = new Map((usersRes.results ?? []).map((u) => [u.email, u.id]));

  const stmt = env.DB.prepare(
    `INSERT INTO group_members (group_id, member_email, member_user_id)
     VALUES (?, ?, ?)
     ON CONFLICT(group_id, member_email) DO UPDATE SET member_user_id = excluded.member_user_id`
  );

  await env.DB.batch(emails.map((email) => stmt.bind(groupId, email, userMap.get(email) ?? null)));
  return emails.length;
}

export async function removeGroupMember(
  groupId: number,
  ownerUserId: number,
  email: string,
  env: Env
): Promise<boolean> {
  const owned = await env.DB.prepare('SELECT id FROM groups WHERE id = ? AND owner_user_id = ?')
    .bind(groupId, ownerUserId)
    .first<{ id: number }>();
  if (!owned) return false;

  const res = await env.DB.prepare(
    'DELETE FROM group_members WHERE group_id = ? AND LOWER(member_email) = ?'
  )
    .bind(groupId, email.trim().toLowerCase())
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function deleteGroup(groupId: number, ownerUserId: number, env: Env): Promise<boolean> {
  const owned = await env.DB.prepare('SELECT id FROM groups WHERE id = ? AND owner_user_id = ?')
    .bind(groupId, ownerUserId)
    .first<{ id: number }>();
  if (!owned) return false;

  await env.DB.batch([
    env.DB.prepare('DELETE FROM profile_group_shares WHERE group_id = ?').bind(groupId),
    env.DB.prepare('DELETE FROM group_members WHERE group_id = ?').bind(groupId),
    env.DB.prepare('DELETE FROM groups WHERE id = ? AND owner_user_id = ?').bind(groupId, ownerUserId),
  ]);
  return true;
}

export async function shareProfileWithGroup(
  profileId: number,
  ownerUserId: number,
  groupId: number,
  canEdit: boolean,
  env: Env
): Promise<boolean> {
  const [ownedProfile, accessibleGroup] = await Promise.all([
    env.DB.prepare('SELECT id FROM otp_profiles WHERE id = ? AND user_id = ?')
      .bind(profileId, ownerUserId)
      .first<{ id: number }>(),
    env.DB.prepare(
      `SELECT g.id FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.member_user_id = ?
       WHERE g.id = ? AND (g.owner_user_id = ? OR gm.member_user_id = ?)
       LIMIT 1`
    )
      .bind(ownerUserId, groupId, ownerUserId, ownerUserId)
      .first<{ id: number }>(),
  ]);

  if (!ownedProfile || !accessibleGroup) return false;

  await env.DB.prepare(
    `INSERT INTO profile_group_shares (profile_id, group_id, shared_by_user_id, can_edit)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(profile_id, group_id)
     DO UPDATE SET can_edit = excluded.can_edit`
  )
    .bind(profileId, groupId, ownerUserId, canEdit ? 1 : 0)
    .run();

  return true;
}

export async function unshareProfileFromGroup(
  profileId: number,
  ownerUserId: number,
  groupId: number,
  env: Env
): Promise<boolean> {
  const owned = await env.DB.prepare('SELECT id FROM otp_profiles WHERE id = ? AND user_id = ?')
    .bind(profileId, ownerUserId)
    .first<{ id: number }>();
  if (!owned) return false;

  const res = await env.DB.prepare(
    'DELETE FROM profile_group_shares WHERE profile_id = ? AND group_id = ?'
  )
    .bind(profileId, groupId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function getProfileGroupShares(profileId: number, ownerUserId: number, env: Env) {
  const res = await env.DB.prepare(
    `SELECT pgs.id, pgs.profile_id, pgs.group_id, pgs.can_edit, pgs.created_at,
            g.name AS group_name,
            (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
     FROM profile_group_shares pgs
     JOIN groups g ON g.id = pgs.group_id
     WHERE pgs.profile_id = ? AND pgs.shared_by_user_id = ?
     ORDER BY g.name ASC`
  )
    .bind(profileId, ownerUserId)
    .all();
  return res.results ?? [];
}
