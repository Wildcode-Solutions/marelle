PRAGMA foreign_keys = ON;

CREATE TABLE daily_challenges (
  id TEXT PRIMARY KEY,
  publication_date TEXT NOT NULL UNIQUE
    CHECK (
      publication_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      AND date(publication_date) = publication_date
    ),
  title TEXT NOT NULL DEFAULT 'Marelle du jour'
    CHECK (length(title) BETWEEN 3 AND 120),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_challenge_questions (
  daily_challenge_id TEXT NOT NULL
    REFERENCES daily_challenges(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL
    REFERENCES questions(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  PRIMARY KEY (daily_challenge_id, question_id),
  UNIQUE (daily_challenge_id, position)
);

CREATE TABLE daily_challenge_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_challenge_id TEXT NOT NULL
    REFERENCES daily_challenges(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE
    REFERENCES learning_sessions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  total_questions INTEGER NOT NULL CHECK (total_questions BETWEEN 3 AND 5),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  duration_seconds INTEGER
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  UNIQUE (user_id, daily_challenge_id),
  CHECK (score <= total_questions)
);

CREATE INDEX idx_daily_challenges_date_status
  ON daily_challenges (publication_date DESC, status);
CREATE INDEX idx_daily_challenge_questions_position
  ON daily_challenge_questions (daily_challenge_id, position);
CREATE INDEX idx_daily_challenge_attempts_challenge
  ON daily_challenge_attempts (daily_challenge_id, completed_at);
CREATE INDEX idx_daily_challenge_attempts_user
  ON daily_challenge_attempts (user_id, started_at DESC);
