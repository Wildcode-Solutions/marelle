PRAGMA foreign_keys = ON;

CREATE TABLE school_levels (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('college', 'lycee')),
  position INTEGER NOT NULL UNIQUE
) STRICT;

CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_level_id TEXT NOT NULL REFERENCES school_levels(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (subject_id, school_level_id, slug)
) STRICT;

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('multiple_choice', 'true_false', 'short_answer')),
  prompt TEXT NOT NULL,
  explanation TEXT NOT NULL,
  expected_answer TEXT,
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  xp_reward INTEGER NOT NULL DEFAULT 10 CHECK (xp_reward > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE answer_choices (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE (question_id, position)
) STRICT;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  school_level_id TEXT NOT NULL REFERENCES school_levels(id),
  avatar_emoji TEXT NOT NULL DEFAULT '🧑‍🎓',
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  daily_goal_xp INTEGER NOT NULL DEFAULT 20 CHECK (daily_goal_xp > 0),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  lives INTEGER NOT NULL DEFAULT 5 CHECK (lives BETWEEN 0 AND 5),
  last_activity_on TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE learning_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('daily', 'chapter', 'review', 'challenge')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  total_answers INTEGER NOT NULL DEFAULT 0 CHECK (total_answers >= 0),
  xp_earned INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned >= 0)
) STRICT;

CREATE TABLE user_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_choice_id TEXT REFERENCES answer_choices(id) ON DELETE SET NULL,
  answer_text TEXT,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  response_time_ms INTEGER CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE user_question_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'mastered', 'review')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  ease_factor REAL NOT NULL DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  last_answered_at TEXT,
  next_review_at TEXT,
  PRIMARY KEY (user_id, question_id)
) STRICT;

CREATE TABLE daily_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  earned_xp INTEGER NOT NULL DEFAULT 0 CHECK (earned_xp >= 0),
  completed_sessions INTEGER NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
  answered_questions INTEGER NOT NULL DEFAULT 0 CHECK (answered_questions >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  goal_reached INTEGER NOT NULL DEFAULT 0 CHECK (goal_reached IN (0, 1)),
  UNIQUE (user_id, activity_date)
) STRICT;

CREATE TABLE achievements (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE TABLE user_achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, achievement_id)
) STRICT;

CREATE TABLE friendships (
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
) STRICT;

CREATE INDEX idx_chapters_level_subject ON chapters (school_level_id, subject_id, position);
CREATE INDEX idx_questions_chapter_status ON questions (chapter_id, status, difficulty);
CREATE INDEX idx_choices_question ON answer_choices (question_id, position);
CREATE INDEX idx_sessions_user_date ON learning_sessions (user_id, started_at DESC);
CREATE INDEX idx_answers_user_question ON user_answers (user_id, question_id, answered_at DESC);
CREATE INDEX idx_progress_review ON user_question_progress (user_id, status, next_review_at);
CREATE INDEX idx_daily_progress_user_date ON daily_progress (user_id, activity_date DESC);
CREATE INDEX idx_friendships_addressee_status ON friendships (addressee_id, status);

INSERT INTO school_levels (id, label, stage, position) VALUES
  ('6e', '6e', 'college', 1),
  ('5e', '5e', 'college', 2),
  ('4e', '4e', 'college', 3),
  ('3e', '3e', 'college', 4),
  ('2de', 'Seconde', 'lycee', 5),
  ('1re', 'Première', 'lycee', 6),
  ('tle', 'Terminale', 'lycee', 7);

INSERT INTO subjects (id, slug, name, short_name, icon, color) VALUES
  ('mathematics', 'mathematiques', 'Mathématiques', 'Maths', '➗', '#6C5CE7'),
  ('french', 'francais', 'Français', 'Français', '📚', '#F06292'),
  ('history-geography', 'histoire-geographie', 'Histoire-géographie', 'Histoire-géo', '🌍', '#F59E0B'),
  ('science', 'sciences', 'Sciences', 'Sciences', '🔬', '#10B981'),
  ('english', 'anglais', 'Anglais', 'Anglais', '💬', '#3B82F6'),
  ('technology', 'technologie', 'Technologie', 'Techno', '⚙️', '#64748B');

INSERT INTO chapters (id, subject_id, school_level_id, slug, title, summary, position) VALUES
  ('math-6e-numbers', 'mathematics', '6e', 'nombres-entiers-decimaux', 'Nombres entiers et décimaux', 'Lire, écrire, comparer et calculer avec les nombres.', 1),
  ('math-6e-geometry', 'mathematics', '6e', 'figures-geometriques', 'Figures géométriques', 'Reconnaître et construire les figures usuelles.', 2),
  ('french-6e-grammar', 'french', '6e', 'classes-grammaticales', 'Les classes grammaticales', 'Identifier la nature des mots dans une phrase.', 1),
  ('history-6e-antiquity', 'history-geography', '6e', 'mondes-antiques', 'Les mondes antiques', 'Découvrir les premières civilisations et leurs héritages.', 1),
  ('science-6e-living', 'science', '6e', 'vivant', 'Le vivant et son évolution', 'Observer et classer la diversité du vivant.', 1),
  ('english-6e-introductions', 'english', '6e', 'introductions', 'Introducing yourself', 'Se présenter et poser des questions simples.', 1);

INSERT INTO questions (id, chapter_id, kind, prompt, explanation, difficulty, xp_reward, status) VALUES
  ('q-math-place-value', 'math-6e-numbers', 'multiple_choice', 'Quel est le chiffre des dixièmes dans 42,75 ?', 'Le chiffre placé juste après la virgule est celui des dixièmes : 7.', 1, 10, 'published'),
  ('q-french-noun', 'french-6e-grammar', 'multiple_choice', 'Dans « Le chat dort », quel mot est un nom ?', '« chat » désigne un animal : c’est un nom commun.', 1, 10, 'published');

INSERT INTO answer_choices (id, question_id, label, is_correct, position) VALUES
  ('a-math-1', 'q-math-place-value', '4', 0, 1),
  ('a-math-2', 'q-math-place-value', '7', 1, 2),
  ('a-math-3', 'q-math-place-value', '5', 0, 3),
  ('a-french-1', 'q-french-noun', 'Le', 0, 1),
  ('a-french-2', 'q-french-noun', 'chat', 1, 2),
  ('a-french-3', 'q-french-noun', 'dort', 0, 3);

INSERT INTO users (id, email, display_name, school_level_id, avatar_emoji, xp, daily_goal_xp, current_streak, longest_streak, lives, last_activity_on)
VALUES ('demo-user', 'eleve@marelle.app', 'Camille', '6e', '🧑‍🚀', 280, 20, 4, 7, 5, date('now'));

INSERT INTO daily_progress (id, user_id, activity_date, earned_xp, completed_sessions, answered_questions, correct_answers, goal_reached)
VALUES ('demo-progress-today', 'demo-user', date('now'), 12, 1, 5, 4, 0);

INSERT INTO achievements (id, slug, name, description, icon, xp_reward) VALUES
  ('first-step', 'premier-pas', 'Premier pas', 'Terminer une première session de révision.', '👟', 20),
  ('week-streak', 'serie-sept-jours', 'Semaine de feu', 'Réviser pendant sept jours consécutifs.', '🔥', 50);

INSERT INTO user_achievements (user_id, achievement_id)
VALUES ('demo-user', 'first-step');
