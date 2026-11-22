-- KeyLedger Dynamic Custody Groups

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_groups_owner_user_id ON groups (owner_user_id);

CREATE TABLE IF NOT EXISTS group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  member_email TEXT NOT NULL,
  member_user_id INTEGER DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_group_member_email ON group_members (group_id, member_email);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members (member_user_id);

CREATE TABLE IF NOT EXISTS profile_group_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  shared_by_user_id INTEGER NOT NULL,
  can_edit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES otp_profiles (id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
  FOREIGN KEY (shared_by_user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_profile_group_share ON profile_group_shares (profile_id, group_id);
CREATE INDEX IF NOT EXISTS idx_profile_group_shares_profile_id ON profile_group_shares (profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_group_shares_group_id ON profile_group_shares (group_id);
