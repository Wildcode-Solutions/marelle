import { HttpError, json } from "../lib/http";

interface ProfileStatsRow {
  best_score_percentage: number;
  completed_challenges: number;
  current_streak: number;
  longest_streak: number;
  xp: number;
}

interface AchievementRow {
  description: string;
  icon: string;
  id: string;
  name: string;
  slug: string;
  unlocked_at: string | null;
}

function isProfileStatsRow(value: unknown): value is ProfileStatsRow {
  if (typeof value !== "object" || value === null) return false;
  return (
    "xp" in value && typeof value.xp === "number" &&
    "current_streak" in value && typeof value.current_streak === "number" &&
    "longest_streak" in value && typeof value.longest_streak === "number" &&
    "completed_challenges" in value && typeof value.completed_challenges === "number" &&
    "best_score_percentage" in value && typeof value.best_score_percentage === "number"
  );
}

function isAchievementRow(value: unknown): value is AchievementRow {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value && typeof value.id === "string" &&
    "slug" in value && typeof value.slug === "string" &&
    "name" in value && typeof value.name === "string" &&
    "description" in value && typeof value.description === "string" &&
    "icon" in value && typeof value.icon === "string" &&
    "unlocked_at" in value &&
      (typeof value.unlocked_at === "string" || value.unlocked_at === null)
  );
}

export async function profileSummary(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const batch = await env.DB.batch([
    env.DB.prepare(
      `SELECT
        u.xp,
        u.current_streak,
        u.longest_streak,
        (
          SELECT COUNT(*)
          FROM daily_challenge_attempts dca
          WHERE dca.user_id = u.id AND dca.completed_at IS NOT NULL
        ) AS completed_challenges,
        COALESCE((
          SELECT MAX(CAST((dca.score * 100.0) / dca.total_questions AS INTEGER))
          FROM daily_challenge_attempts dca
          WHERE dca.user_id = u.id AND dca.completed_at IS NOT NULL
        ), 0) AS best_score_percentage
       FROM users u
       WHERE u.id = ?1`,
    ).bind(userId),
    env.DB.prepare(
      `SELECT
        a.id,
        a.slug,
        a.name,
        a.description,
        a.icon,
        ua.unlocked_at
       FROM achievements a
       LEFT JOIN user_achievements ua
         ON ua.achievement_id = a.id AND ua.user_id = ?1
       WHERE a.is_active = 1
       ORDER BY ua.unlocked_at IS NULL, ua.unlocked_at, a.name COLLATE NOCASE`,
    ).bind(userId),
  ]);

  const stats = batch[0]?.results[0];
  if (!isProfileStatsRow(stats)) {
    throw new HttpError(404, "Utilisateur introuvable.");
  }
  const badges = (batch[1]?.results ?? []).filter(isAchievementRow);

  return json(request, {
    stats: {
      xp: stats.xp,
      level: Math.floor(stats.xp / 100) + 1,
      currentStreak: stats.current_streak,
      longestStreak: stats.longest_streak,
      completedChallenges: stats.completed_challenges,
      bestScorePercentage: stats.best_score_percentage,
    },
    badges: badges.map((badge) => ({
      id: badge.id,
      slug: badge.slug,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      unlocked: badge.unlocked_at !== null,
      unlockedAt: badge.unlocked_at,
    })),
  });
}
