import { HttpError, json } from "../lib/http";

interface UserRow {
  id: string;
  role: "student" | "admin";
  display_name: string;
  avatar_emoji: string;
  school_level_id: string;
  school_level_label: string;
  xp: number;
  daily_goal_xp: number;
  current_streak: number;
  longest_streak: number;
  lives: number;
}

interface DailyProgressRow {
  earned_xp: number;
  completed_sessions: number;
  answered_questions: number;
  correct_answers: number;
}

interface SubjectRow {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  icon: string;
  color: string;
  chapter_count: number;
}

function isDailyProgressRow(value: unknown): value is DailyProgressRow {
  if (typeof value !== "object" || value === null) return false;

  return (
    "earned_xp" in value &&
    typeof value.earned_xp === "number" &&
    "completed_sessions" in value &&
    typeof value.completed_sessions === "number" &&
    "answered_questions" in value &&
    typeof value.answered_questions === "number" &&
    "correct_answers" in value &&
    typeof value.correct_answers === "number"
  );
}

function isSubjectRow(value: unknown): value is SubjectRow {
  if (typeof value !== "object" || value === null) return false;

  return (
    "id" in value &&
    typeof value.id === "string" &&
    "slug" in value &&
    typeof value.slug === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "short_name" in value &&
    typeof value.short_name === "string" &&
    "icon" in value &&
    typeof value.icon === "string" &&
    "color" in value &&
    typeof value.color === "string" &&
    "chapter_count" in value &&
    typeof value.chapter_count === "number"
  );
}

export async function dashboard(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const user = await env.DB.prepare(
    `SELECT
      u.id,
      u.role,
      u.display_name,
      u.avatar_emoji,
      u.school_level_id,
      l.label AS school_level_label,
      u.xp,
      u.daily_goal_xp,
      u.current_streak,
      u.longest_streak,
      u.lives
    FROM users u
    JOIN school_levels l ON l.id = u.school_level_id
    WHERE u.id = ?1`,
  )
    .bind(userId)
    .first<UserRow>();

  if (!user) throw new HttpError(404, "Utilisateur introuvable.");

  const batchResults = await env.DB.batch([
    env.DB.prepare(
      `SELECT earned_xp, completed_sessions, answered_questions, correct_answers
       FROM daily_progress
       WHERE user_id = ?1 AND activity_date = date('now')`,
    ).bind(user.id),
    env.DB.prepare(
      `SELECT
        s.id,
        s.slug,
        s.name,
        s.short_name,
        s.icon,
        s.color,
        COUNT(c.id) AS chapter_count
       FROM subjects s
       LEFT JOIN chapters c
         ON c.subject_id = s.id
        AND c.school_level_id = ?1
        AND c.is_active = 1
       WHERE s.is_active = 1
       GROUP BY s.id
       ORDER BY s.created_at, s.name`,
    ).bind(user.school_level_id),
  ]);

  const progressResult = batchResults[0];
  const subjectsResult = batchResults[1];
  if (!progressResult || !subjectsResult) {
    throw new Error("D1 returned an incomplete dashboard batch");
  }

  const progressCandidate = progressResult.results[0];
  const progress = isDailyProgressRow(progressCandidate) ? progressCandidate : undefined;
  const subjects = subjectsResult.results.filter(isSubjectRow);

  return json(request, {
    user: {
      id: user.id,
      role: user.role,
      displayName: user.display_name,
      avatarEmoji: user.avatar_emoji,
      schoolLevel: {
        id: user.school_level_id,
        label: user.school_level_label,
      },
      xp: user.xp,
      level: Math.floor(user.xp / 100) + 1,
      currentStreak: user.current_streak,
      longestStreak: user.longest_streak,
      lives: user.lives,
    },
    today: {
      earnedXp: progress?.earned_xp ?? 0,
      goalXp: user.daily_goal_xp,
      completedSessions: progress?.completed_sessions ?? 0,
      answeredQuestions: progress?.answered_questions ?? 0,
      correctAnswers: progress?.correct_answers ?? 0,
    },
    subjects: subjects.map((subject) => ({
      id: subject.id,
      slug: subject.slug,
      name: subject.name,
      shortName: subject.short_name,
      icon: subject.icon,
      color: subject.color,
      chapterCount: subject.chapter_count,
    })),
  });
}
