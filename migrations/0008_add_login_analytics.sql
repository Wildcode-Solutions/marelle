PRAGMA foreign_keys = ON;

CREATE TABLE user_login_events (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('registration', 'login')),
  occurred_at INTEGER NOT NULL DEFAULT (unixepoch())
) STRICT;

CREATE INDEX idx_user_login_events_user_date
  ON user_login_events (user_id, occurred_at DESC);

CREATE INDEX idx_user_login_events_date
  ON user_login_events (occurred_at DESC);

-- Les sessions encore présentes correspondent à des connexions déjà connues.
-- Les sessions supprimées avant cette migration ne peuvent pas être reconstituées.
INSERT OR IGNORE INTO user_login_events (id, user_id, event_type, occurred_at)
SELECT id, user_id, 'login', created_at
FROM auth_sessions;
