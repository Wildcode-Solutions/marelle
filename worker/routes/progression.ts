import { currentAppDate } from "../lib/date";
import { json } from "../lib/http";

interface ActivityRow {
  activity_date: string;
  answered_questions: number;
  completed_sessions: number;
  correct_answers: number;
  earned_xp: number;
  goal_reached: number;
}

interface MistakeRow {
  attempts: number;
  chapter_title: string;
  correct_answer: string;
  correct_answers: number;
  explanation: string;
  last_answered_at: string;
  prompt: string;
  question_id: string;
  subject_color: string;
  subject_icon: string;
  subject_name: string;
}

interface ChallengeHistoryRow {
  challenge_id: string;
  completed_at: string;
  duration_seconds: number | null;
  id: string;
  publication_date: string;
  score: number;
  title: string;
  total_questions: number;
}

function isActivityRow(value: unknown): value is ActivityRow {
  if (typeof value !== "object" || value === null) return false;
  return (
    "activity_date" in value && typeof value.activity_date === "string" &&
    "answered_questions" in value && typeof value.answered_questions === "number" &&
    "completed_sessions" in value && typeof value.completed_sessions === "number" &&
    "correct_answers" in value && typeof value.correct_answers === "number" &&
    "earned_xp" in value && typeof value.earned_xp === "number" &&
    "goal_reached" in value && typeof value.goal_reached === "number"
  );
}

function isMistakeRow(value: unknown): value is MistakeRow {
  if (typeof value !== "object" || value === null) return false;
  return (
    "question_id" in value && typeof value.question_id === "string" &&
    "prompt" in value && typeof value.prompt === "string" &&
    "explanation" in value && typeof value.explanation === "string" &&
    "correct_answer" in value && typeof value.correct_answer === "string" &&
    "chapter_title" in value && typeof value.chapter_title === "string" &&
    "subject_name" in value && typeof value.subject_name === "string" &&
    "subject_icon" in value && typeof value.subject_icon === "string" &&
    "subject_color" in value && typeof value.subject_color === "string" &&
    "attempts" in value && typeof value.attempts === "number" &&
    "correct_answers" in value && typeof value.correct_answers === "number" &&
    "last_answered_at" in value && typeof value.last_answered_at === "string"
  );
}

function isChallengeHistoryRow(value: unknown): value is ChallengeHistoryRow {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value && typeof value.id === "string" &&
    "challenge_id" in value && typeof value.challenge_id === "string" &&
    "publication_date" in value && typeof value.publication_date === "string" &&
    "title" in value && typeof value.title === "string" &&
    "score" in value && typeof value.score === "number" &&
    "total_questions" in value && typeof value.total_questions === "number" &&
    "duration_seconds" in value &&
      (typeof value.duration_seconds === "number" || value.duration_seconds === null) &&
    "completed_at" in value && typeof value.completed_at === "string"
  );
}

export async function progression(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const today = currentAppDate();
  const batch = await env.DB.batch([
    env.DB.prepare(
      `WITH RECURSIVE activity_days(activity_date) AS (
        SELECT date(?2, '-59 days')
        UNION ALL
        SELECT date(activity_date, '+1 day')
        FROM activity_days
        WHERE activity_date < ?2
      )
      SELECT
        activity_days.activity_date,
        COALESCE(dp.earned_xp, 0) AS earned_xp,
        COALESCE(dp.completed_sessions, 0) AS completed_sessions,
        COALESCE(dp.answered_questions, 0) AS answered_questions,
        COALESCE(dp.correct_answers, 0) AS correct_answers,
        COALESCE(dp.goal_reached, 0) AS goal_reached
      FROM activity_days
      LEFT JOIN daily_progress dp
        ON dp.user_id = ?1 AND dp.activity_date = activity_days.activity_date
      ORDER BY activity_days.activity_date`,
    ).bind(userId, today),
    env.DB.prepare(
      `SELECT
        q.id AS question_id,
        q.prompt,
        q.explanation,
        CASE COALESCE(q.response_kind, q.kind)
          WHEN 'multiple_choice' THEN COALESCE((
            SELECT ac.label
            FROM answer_choices ac
            WHERE ac.question_id = q.id AND ac.is_correct = 1
            ORDER BY ac.position
            LIMIT 1
          ), '')
          WHEN 'true_false' THEN COALESCE((
            SELECT ac.label
            FROM answer_choices ac
            WHERE ac.question_id = q.id AND ac.is_correct = 1
            ORDER BY ac.position
            LIMIT 1
          ), '')
          WHEN 'short_answer' THEN COALESCE(q.expected_answer, '')
          WHEN 'numeric' THEN COALESCE(q.expected_answer, '') ||
            CASE WHEN q.answer_unit IS NULL OR q.answer_unit = '' THEN '' ELSE ' ' || q.answer_unit END
          WHEN 'ordering' THEN COALESCE((
            SELECT GROUP_CONCAT(ordered_items.item_answer, ' → ')
            FROM (
              SELECT qi.item_answer
              FROM question_items qi
              WHERE qi.question_id = q.id
              ORDER BY qi.position
            ) AS ordered_items
          ), '')
          WHEN 'matching' THEN COALESCE((
            SELECT GROUP_CONCAT(matching_items.pair, ' · ')
            FROM (
              SELECT COALESCE(qi.item_prompt, '') || ' → ' || qi.item_answer AS pair
              FROM question_items qi
              WHERE qi.question_id = q.id
              ORDER BY qi.position
            ) AS matching_items
          ), '')
          ELSE COALESCE((
            SELECT GROUP_CONCAT(blank_items.item_answer, ' · ')
            FROM (
              SELECT qi.item_answer
              FROM question_items qi
              WHERE qi.question_id = q.id
              ORDER BY qi.position
            ) AS blank_items
          ), '')
        END AS correct_answer,
        c.title AS chapter_title,
        s.name AS subject_name,
        s.icon AS subject_icon,
        s.color AS subject_color,
        uqp.attempts,
        uqp.correct_answers,
        uqp.last_answered_at
      FROM user_question_progress uqp
      JOIN questions q ON q.id = uqp.question_id
      JOIN chapters c ON c.id = q.chapter_id
      JOIN subjects s ON s.id = c.subject_id
      WHERE uqp.user_id = ?1 AND uqp.status = 'review'
      ORDER BY uqp.last_answered_at DESC
      LIMIT 6`,
    ).bind(userId),
    env.DB.prepare(
      `SELECT
        dca.id,
        dca.daily_challenge_id AS challenge_id,
        dc.publication_date,
        dc.title,
        dca.score,
        dca.total_questions,
        dca.duration_seconds,
        dca.completed_at
      FROM daily_challenge_attempts dca
      JOIN daily_challenges dc ON dc.id = dca.daily_challenge_id
      WHERE dca.user_id = ?1 AND dca.completed_at IS NOT NULL
      ORDER BY dca.completed_at DESC
      LIMIT 10`,
    ).bind(userId),
  ]);

  const activity = batch[0]?.results ?? [];
  const mistakes = batch[1]?.results ?? [];
  const history = batch[2]?.results ?? [];
  if (
    activity.length !== 60 ||
    !activity.every(isActivityRow) ||
    !mistakes.every(isMistakeRow) ||
    !history.every(isChallengeHistoryRow)
  ) {
    throw new Error("Unexpected progression query result");
  }

  return json(request, {
    today,
    activity: activity.map((day) => ({
      date: day.activity_date,
      earnedXp: day.earned_xp,
      completedSessions: day.completed_sessions,
      answeredQuestions: day.answered_questions,
      correctAnswers: day.correct_answers,
      goalReached: day.goal_reached === 1,
    })),
    mistakes: mistakes.map((mistake) => ({
      questionId: mistake.question_id,
      prompt: mistake.prompt,
      explanation: mistake.explanation,
      correctAnswer: mistake.correct_answer,
      chapterTitle: mistake.chapter_title,
      subject: {
        name: mistake.subject_name,
        icon: mistake.subject_icon,
        color: mistake.subject_color,
      },
      attempts: mistake.attempts,
      correctAnswers: mistake.correct_answers,
      lastAnsweredAt: mistake.last_answered_at,
    })),
    history: history.map((attempt) => ({
      id: attempt.id,
      challengeId: attempt.challenge_id,
      date: attempt.publication_date,
      title: attempt.title,
      score: attempt.score,
      totalQuestions: attempt.total_questions,
      percentage: Math.round((attempt.score * 100) / attempt.total_questions),
      durationSeconds: attempt.duration_seconds,
      completedAt: attempt.completed_at,
    })),
  });
}
