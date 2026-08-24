PRAGMA foreign_keys = ON;

-- ============================================================
-- Configuration des 8 ligues (données fixes)
-- ============================================================
CREATE TABLE leagues (
  key        TEXT PRIMARY KEY
               CHECK (key IN ('iron','bronze','silver','gold','platinum','emerald','ruby','diamond')),
  name       TEXT NOT NULL,
  rank_order INTEGER NOT NULL UNIQUE CHECK (rank_order BETWEEN 1 AND 8),
  icon       TEXT NOT NULL,
  color      TEXT NOT NULL
);

INSERT INTO leagues (key, name, rank_order, icon, color) VALUES
  ('iron',     'Fer',     1, '⚙️',  '#78909C'),
  ('bronze',   'Bronze',  2, '🥉',  '#A0522D'),
  ('silver',   'Argent',  3, '🥈',  '#90A4AE'),
  ('gold',     'Or',      4, '🥇',  '#F9A825'),
  ('platinum', 'Platine', 5, '💠',  '#B0BEC5'),
  ('emerald',  'Émeraude',6, '💚',  '#43A047'),
  ('ruby',     'Rubis',   7, '❤️',  '#E53935'),
  ('diamond',  'Diamant', 8, '💎',  '#29B6F6');


-- ============================================================
-- Ligue permanente de l'utilisateur
-- ============================================================
CREATE TABLE user_leagues (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  league_key TEXT NOT NULL DEFAULT 'iron' REFERENCES leagues(key),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- Semaines de compétition  (identifiant ISO : '2026-W35')
-- ============================================================
CREATE TABLE league_weeks (
  id           TEXT PRIMARY KEY,   -- ex : '2026-W35'
  week_start   TEXT NOT NULL,      -- YYYY-MM-DD (lundi)
  week_end     TEXT NOT NULL,      -- YYYY-MM-DD (dimanche)
  processed_at TEXT,               -- NULL tant que non traitée
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (week_start < week_end)
);


-- ============================================================
-- Groupes (~30 joueurs, par ligue + semaine)
-- ============================================================
CREATE TABLE league_groups (
  id             TEXT PRIMARY KEY,
  league_week_id TEXT NOT NULL REFERENCES league_weeks(id),
  league_key     TEXT NOT NULL REFERENCES leagues(key),
  group_number   INTEGER NOT NULL CHECK (group_number >= 1),
  UNIQUE (league_week_id, league_key, group_number)
);


-- ============================================================
-- Membres d'un groupe (participation hebdomadaire)
-- ============================================================
CREATE TABLE league_group_members (
  id               TEXT PRIMARY KEY,
  league_group_id  TEXT NOT NULL REFERENCES league_groups(id),
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekly_xp        INTEGER NOT NULL DEFAULT 0 CHECK (weekly_xp >= 0),
  xp_reached_at    TEXT,       -- horodatage du dernier crédit XP (départage à égalité)
  final_rank       INTEGER,    -- NULL jusqu'au traitement de fin de semaine
  result           TEXT CHECK (result IN ('promoted', 'stayed', 'relegated')),
  joined_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Un utilisateur ne peut participer qu'à UN groupe par semaine
  -- (via league_group → league_week)
  UNIQUE (league_group_id, user_id)
);


-- ============================================================
-- Historique (une ligne par semaine participée)
-- ============================================================
CREATE TABLE league_history (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league_week_id TEXT NOT NULL REFERENCES league_weeks(id),
  league_key     TEXT NOT NULL,
  group_id       TEXT NOT NULL,
  final_rank     INTEGER NOT NULL,
  weekly_xp      INTEGER NOT NULL,
  result         TEXT NOT NULL CHECK (result IN ('promoted', 'stayed', 'relegated')),
  recorded_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, league_week_id)
);


-- ============================================================
-- Événements XP (audit + protection contre double attribution)
-- ============================================================
CREATE TABLE league_xp_events (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league_group_member_id TEXT NOT NULL REFERENCES league_group_members(id),
  amount                INTEGER NOT NULL CHECK (amount >= 0),   -- XP effectivement crédités
  raw_amount            INTEGER NOT NULL CHECK (raw_amount >= 0), -- XP bruts avant anti-farming
  reason                TEXT NOT NULL
    CHECK (reason IN (
      'DAILY_CHALLENGE_COMPLETION',
      'CORRECT_ANSWER',
      'PERFECT_DAILY_CHALLENGE',
      'DAILY_FIRST_ACTIVITY',
      'TRAINING_CORRECT_ANSWER',
      'CORRECTED_MISTAKE'
    )),
  source_type           TEXT,  -- 'daily_challenge_attempt' | 'learning_session' | null
  source_id             TEXT,  -- ID de la source
  created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Empêche l'attribution deux fois de la même récompense pour la même source
  UNIQUE (source_type, source_id, reason)
);


-- ============================================================
-- Compteur anti-farming (XP d'entraînement par jour)
-- ============================================================
CREATE TABLE league_daily_training_xp (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  training_xp   INTEGER NOT NULL DEFAULT 0 CHECK (training_xp >= 0),
  PRIMARY KEY (user_id, activity_date)
);


-- ============================================================
-- Objectifs hebdomadaires (structure préparée — non actifs en V1)
-- ============================================================
CREATE TABLE league_weekly_objectives (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL,
  target_value INTEGER NOT NULL CHECK (target_value > 0),
  xp_reward    INTEGER NOT NULL CHECK (xp_reward >= 0),
  is_active    INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1))
);


-- ============================================================
-- Index de performance
-- ============================================================
CREATE INDEX idx_league_group_members_group_xp
  ON league_group_members (league_group_id, weekly_xp DESC, xp_reached_at);

CREATE INDEX idx_league_group_members_user
  ON league_group_members (user_id);

CREATE INDEX idx_league_groups_week_key
  ON league_groups (league_week_id, league_key);

CREATE INDEX idx_league_xp_events_member
  ON league_xp_events (league_group_member_id, created_at DESC);

CREATE INDEX idx_league_history_user
  ON league_history (user_id, recorded_at DESC);

CREATE INDEX idx_league_weeks_start
  ON league_weeks (week_start DESC);
