ALTER TABLE users
ADD COLUMN password_hash TEXT;

ALTER TABLE users
ADD COLUMN password_salt TEXT;

ALTER TABLE users
ADD COLUMN password_iterations INTEGER
CHECK (password_iterations IS NULL OR password_iterations >= 100000);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;

CREATE INDEX idx_auth_sessions_user ON auth_sessions (user_id);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions (expires_at);
