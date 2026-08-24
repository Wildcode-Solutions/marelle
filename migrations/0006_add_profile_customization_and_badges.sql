ALTER TABLE users
ADD COLUMN profile_color TEXT NOT NULL DEFAULT '#6C5CE7';

INSERT OR IGNORE INTO achievements (id, slug, name, description, icon, xp_reward) VALUES
  (
    'perfect-round',
    'sans-faute',
    'Sans faute',
    'Réussir toutes les questions d’une Marelle.',
    '🎯',
    0
  ),
  (
    'xp-century',
    'cap-des-100-xp',
    'Cap des 100 XP',
    'Cumuler au moins 100 XP.',
    '💯',
    0
  );

INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
SELECT user_id, 'first-step', MIN(completed_at)
FROM learning_sessions
WHERE completed_at IS NOT NULL
GROUP BY user_id;

INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
SELECT user_id, 'perfect-round', MIN(completed_at)
FROM daily_challenge_attempts
WHERE completed_at IS NOT NULL AND score = total_questions
GROUP BY user_id;

INSERT OR IGNORE INTO user_achievements (user_id, achievement_id)
SELECT id, 'xp-century'
FROM users
WHERE xp >= 100;

INSERT OR IGNORE INTO user_achievements (user_id, achievement_id)
SELECT id, 'week-streak'
FROM users
WHERE longest_streak >= 7;
