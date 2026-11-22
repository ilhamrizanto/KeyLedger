-- KeyLedger Enterprise Features: Security Audit Trail & Per-User Pinned Tokens

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER DEFAULT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT DEFAULT '',
  details TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email ON audit_logs (actor_email);

CREATE TABLE IF NOT EXISTS pinned_profiles (
  user_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, profile_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES otp_profiles (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pinned_profiles_user_id ON pinned_profiles (user_id);
