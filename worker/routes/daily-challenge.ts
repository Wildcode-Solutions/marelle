import { currentAppDate } from "../lib/date";
import { HttpError, json, readJsonObject } from "../lib/http";
import {
  evaluateAnswer,
  recordAnswer,
  type AnswerSubmission,
  type QuestionKind,
} from "../lib/questions";

interface ChallengeRow {
  id: string;
  publication_date: string;
  question_count: number;
  title: string;
}

interface QuestionRow {
  answer_unit: string | null;
  choice_id: string | null;
  choice_label: string | null;
  choice_position: number | null;
  difficulty: number;
  id: string;
  item_answer: string | null;
  item_id: string | null;
  item_position: number | null;
  item_prompt: string | null;
  kind: QuestionKind;
  position: number;
  prompt: string;
}

interface AttemptRow {
  completed_at: string | null;
  duration_seconds: number | null;
  id: string;
  score: number;
  session_id: string;
  started_at: string;
  total_questions: number;
}

interface AttemptAccessRow extends AttemptRow {
  challenge_date: string;
  challenge_status: "draft" | "published";
  daily_challenge_id: string;
}

interface AttemptAnswerRow {
  is_correct: number;
  question_id: string;
}

interface AnswerStatsRow {
  answered: number;
  correct: number;
  xp_earned: number;
}

interface UserStreakRow {
  current_streak: number;
}

export interface DailyChallengeQuestion {
  answerUnit: string | null;
  blankCount: number;
  choices: Array<{ id: string; label: string }>;
  difficulty: number;
  id: string;
  kind: QuestionRow["kind"];
  matchingOptions: Array<{ id: string; label: string }>;
  matchingPrompts: Array<{ label: string; position: number }>;
  orderingItems: Array<{ id: string; label: string }>;
  position: number;
  prompt: string;
}

function requiredIdentifier(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.length < 1 || value.length > 100) {
    throw new HttpError(400, `Le champ ${field} est invalide.`);
  }
  return value;
}

function responseTime(body: Record<string, unknown>): number | null {
  const value = body.responseTimeMs;
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 3_600_000) {
    throw new HttpError(400, "Le temps de réponse est invalide.");
  }
  return value as number;
}

function answerSubmission(body: Record<string, unknown>): AnswerSubmission {
  const choice = body.answerChoiceId;
  const answerText = body.answerText;
  const blankAnswers = body.blankAnswers;
  const orderedItemIds = body.orderedItemIds;
  const matches = body.matches;

  if (
    choice !== undefined &&
    choice !== null &&
    (typeof choice !== "string" || choice.length < 1 || choice.length > 100)
  ) {
    throw new HttpError(400, "Le choix de réponse est invalide.");
  }
  if (
    answerText !== undefined &&
    answerText !== null &&
    (typeof answerText !== "string" || answerText.trim().length < 1 || answerText.length > 300)
  ) {
    throw new HttpError(400, "La réponse écrite est invalide.");
  }
  if (
    blankAnswers !== undefined &&
    blankAnswers !== null &&
    (!Array.isArray(blankAnswers) ||
      blankAnswers.length < 1 ||
      blankAnswers.length > 6 ||
      blankAnswers.some(
        (answer) => typeof answer !== "string" || answer.trim().length < 1 || answer.length > 200,
      ))
  ) {
    throw new HttpError(400, "Les réponses à compléter sont invalides.");
  }
  if (
    orderedItemIds !== undefined &&
    orderedItemIds !== null &&
    (!Array.isArray(orderedItemIds) ||
      orderedItemIds.length < 2 ||
      orderedItemIds.length > 8 ||
      orderedItemIds.some((id) => typeof id !== "string" || id.length < 1 || id.length > 100))
  ) {
    throw new HttpError(400, "La liste ordonnée est invalide.");
  }
  if (
    matches !== undefined &&
    matches !== null &&
    (!Array.isArray(matches) ||
      matches.length < 2 ||
      matches.length > 8 ||
      matches.some(
        (match) =>
          typeof match !== "object" ||
          match === null ||
          !Number.isInteger((match as Record<string, unknown>).promptPosition) ||
          ((match as Record<string, unknown>).promptPosition as number) < 1 ||
          ((match as Record<string, unknown>).promptPosition as number) > 8 ||
          typeof (match as Record<string, unknown>).answerItemId !== "string" ||
          ((match as Record<string, unknown>).answerItemId as string).length < 1 ||
          ((match as Record<string, unknown>).answerItemId as string).length > 100,
      ))
  ) {
    throw new HttpError(400, "Les associations sont invalides.");
  }

  return {
    answerChoiceId: typeof choice === "string" ? choice : null,
    answerText: typeof answerText === "string" ? answerText.trim() : null,
    blankAnswers: Array.isArray(blankAnswers)
      ? (blankAnswers as string[]).map((answer) => answer.trim())
      : null,
    matches: Array.isArray(matches)
      ? (matches as Array<{ answerItemId: string; promptPosition: number }>)
      : null,
    orderedItemIds: Array.isArray(orderedItemIds) ? (orderedItemIds as string[]) : null,
  };
}

function stableShuffle<T>(values: T[], seed: string): T[] {
  const shuffled = [...values];
  let state = 2_166_136_261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16_777_619);
  }
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const target = (state >>> 0) % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  if (shuffled.length > 1 && shuffled.every((value, index) => value === values[index])) {
    [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
  }
  return shuffled;
}

async function activeChallenge(env: Env, date: string): Promise<ChallengeRow | null> {
  return env.DB.prepare(
    `SELECT
      dc.id,
      dc.publication_date,
      dc.title,
      COUNT(dcq.question_id) AS question_count
     FROM daily_challenges dc
     JOIN daily_challenge_questions dcq ON dcq.daily_challenge_id = dc.id
     WHERE dc.publication_date = ?1 AND dc.status = 'published'
     GROUP BY dc.id
     HAVING COUNT(dcq.question_id) BETWEEN 3 AND 5`,
  )
    .bind(date)
    .first<ChallengeRow>();
}

async function challengeQuestions(
  env: Env,
  challengeId: string,
): Promise<DailyChallengeQuestion[]> {
  const { results } = await env.DB.prepare(
    `SELECT
      q.id,
      COALESCE(q.response_kind, q.kind) AS kind,
      q.prompt,
      q.difficulty,
      q.answer_unit,
      dcq.position,
      ac.id AS choice_id,
      ac.label AS choice_label,
      ac.position AS choice_position,
      qi.id AS item_id,
      qi.item_prompt,
      qi.item_answer,
      qi.position AS item_position
     FROM daily_challenge_questions dcq
     JOIN questions q ON q.id = dcq.question_id
     LEFT JOIN answer_choices ac ON ac.question_id = q.id
     LEFT JOIN question_items qi ON qi.question_id = q.id
     WHERE dcq.daily_challenge_id = ?1
     ORDER BY dcq.position, ac.position, qi.position`,
  )
    .bind(challengeId)
    .all<QuestionRow>();

  const grouped = new Map<string, DailyChallengeQuestion>();
  for (const row of results) {
    const question = grouped.get(row.id) ?? {
      id: row.id,
      kind: row.kind,
      prompt: row.prompt,
      difficulty: row.difficulty,
      position: row.position,
      choices: [],
      answerUnit: row.answer_unit,
      blankCount: 0,
      orderingItems: [],
      matchingPrompts: [],
      matchingOptions: [],
    };
    if (row.choice_id && row.choice_label) {
      question.choices.push({ id: row.choice_id, label: row.choice_label });
    }
    if (row.item_id && row.item_answer && row.item_position) {
      if (row.kind === "fill_in_blank") question.blankCount += 1;
      if (row.kind === "ordering") {
        question.orderingItems.push({ id: row.item_id, label: row.item_answer });
      }
      if (row.kind === "matching" && row.item_prompt) {
        question.matchingPrompts.push({ label: row.item_prompt, position: row.item_position });
        question.matchingOptions.push({ id: row.item_id, label: row.item_answer });
      }
    }
    grouped.set(row.id, question);
  }

  return Array.from(grouped.values()).map((question) => ({
    ...question,
    orderingItems: stableShuffle(
      question.orderingItems,
      `${challengeId}:${question.id}:ordering`,
    ),
    matchingOptions: stableShuffle(
      question.matchingOptions,
      `${challengeId}:${question.id}:matching`,
    ),
  }));
}

async function userAttempt(
  env: Env,
  userId: string,
  challengeId: string,
): Promise<AttemptRow | null> {
  return env.DB.prepare(
    `SELECT
      id,
      session_id,
      score,
      total_questions,
      started_at,
      completed_at,
      duration_seconds
     FROM daily_challenge_attempts
     WHERE user_id = ?1 AND daily_challenge_id = ?2`,
  )
    .bind(userId, challengeId)
    .first<AttemptRow>();
}

async function attemptAnswers(env: Env, sessionId: string): Promise<AttemptAnswerRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT question_id, is_correct
     FROM user_answers
     WHERE session_id = ?1
     ORDER BY answered_at, id`,
  )
    .bind(sessionId)
    .all<AttemptAnswerRow>();
  return results;
}

async function userStreak(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare("SELECT current_streak FROM users WHERE id = ?1")
    .bind(userId)
    .first<UserStreakRow>();
  return row?.current_streak ?? 0;
}

async function challengePayload(env: Env, userId: string) {
  const challenge = await activeChallenge(env, currentAppDate());
  if (!challenge) return null;

  const [questions, attempt] = await Promise.all([
    challengeQuestions(env, challenge.id),
    userAttempt(env, userId, challenge.id),
  ]);
  const answers = attempt ? await attemptAnswers(env, attempt.session_id) : [];
  const score = answers.reduce((total, answer) => total + answer.is_correct, 0);

  return {
    id: challenge.id,
    date: challenge.publication_date,
    title: challenge.title,
    questionCount: questions.length,
    estimatedMinutes: Math.max(1, Math.ceil(questions.length * 0.6)),
    questions,
    participation: {
      status: attempt?.completed_at
        ? "completed"
        : attempt
          ? "in_progress"
          : "available",
      attemptId: attempt?.id ?? null,
      startedAt: attempt?.started_at ?? null,
      completedAt: attempt?.completed_at ?? null,
      durationSeconds: attempt?.duration_seconds ?? null,
      score,
      totalQuestions: attempt?.total_questions ?? questions.length,
      answers: answers.map((answer) => ({
        questionId: answer.question_id,
        isCorrect: answer.is_correct === 1,
      })),
      currentStreak: attempt?.completed_at ? await userStreak(env, userId) : null,
    },
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

export async function dailyChallenge(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  return json(request, { challenge: await challengePayload(env, userId) });
}

export async function startDailyChallenge(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const challenge = await activeChallenge(env, currentAppDate());
  if (!challenge) throw new HttpError(404, "Aucune Marelle n’est publiée aujourd’hui.");

  let attempt = await userAttempt(env, userId, challenge.id);
  if (!attempt) {
    const attemptId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO learning_sessions (
            id, user_id, mode, total_answers
          ) VALUES (?1, ?2, 'challenge', ?3)`,
        ).bind(sessionId, userId, challenge.question_count),
        env.DB.prepare(
          `INSERT INTO daily_challenge_attempts (
            id, user_id, daily_challenge_id, session_id, total_questions
          ) VALUES (?1, ?2, ?3, ?4, ?5)`,
        ).bind(attemptId, userId, challenge.id, sessionId, challenge.question_count),
      ]);
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
    attempt = await userAttempt(env, userId, challenge.id);
  }

  if (!attempt) throw new Error("Daily challenge attempt could not be initialized");
  return json(request, { challenge: await challengePayload(env, userId) }, { status: 200 });
}

async function attemptForUser(
  env: Env,
  attemptId: string,
  userId: string,
): Promise<AttemptAccessRow> {
  const attempt = await env.DB.prepare(
    `SELECT
      dca.id,
      dca.daily_challenge_id,
      dca.session_id,
      dca.score,
      dca.total_questions,
      dca.started_at,
      dca.completed_at,
      dca.duration_seconds,
      dc.publication_date AS challenge_date,
      dc.status AS challenge_status
     FROM daily_challenge_attempts dca
     JOIN daily_challenges dc ON dc.id = dca.daily_challenge_id
     WHERE dca.id = ?1 AND dca.user_id = ?2`,
  )
    .bind(attemptId, userId)
    .first<AttemptAccessRow>();
  if (!attempt) throw new HttpError(404, "Participation introuvable.");
  return attempt;
}

function assertAttemptPlayable(attempt: AttemptAccessRow): void {
  if (attempt.completed_at) {
    throw new HttpError(409, "Cette Marelle est déjà terminée et ne peut pas être rejouée.");
  }
  if (attempt.challenge_status !== "published" || attempt.challenge_date !== currentAppDate()) {
    throw new HttpError(409, "Cette Marelle n’est plus disponible.");
  }
}

async function answerStats(env: Env, sessionId: string): Promise<AnswerStatsRow> {
  const stats = await env.DB.prepare(
    `SELECT
      COUNT(ua.id) AS answered,
      COALESCE(SUM(ua.is_correct), 0) AS correct,
      COALESCE(SUM(CASE WHEN ua.is_correct = 1 THEN q.xp_reward ELSE 0 END), 0) AS xp_earned
     FROM user_answers ua
     JOIN questions q ON q.id = ua.question_id
     WHERE ua.session_id = ?1`,
  )
    .bind(sessionId)
    .first<AnswerStatsRow>();
  return stats ?? { answered: 0, correct: 0, xp_earned: 0 };
}

export async function answerDailyChallenge(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const body = await readJsonObject(request);
  const attemptId = requiredIdentifier(body, "attemptId");
  const questionId = requiredIdentifier(body, "questionId");
  const submission = answerSubmission(body);
  const attempt = await attemptForUser(env, attemptId, userId);
  assertAttemptPlayable(attempt);

  const challengeQuestion = await env.DB.prepare(
    `SELECT 1 AS found
     FROM daily_challenge_questions
     WHERE daily_challenge_id = ?1 AND question_id = ?2`,
  )
    .bind(attempt.daily_challenge_id, questionId)
    .first<{ found: number }>();
  if (!challengeQuestion) {
    throw new HttpError(400, "Cette question ne fait pas partie de la Marelle du jour.");
  }

  const evaluation = await evaluateAnswer(env, questionId, submission);
  await recordAnswer(env, {
    answer: submission,
    evaluation,
    questionId,
    responseTimeMs: responseTime(body),
    sessionId: attempt.session_id,
    userId,
  });
  const stats = await answerStats(env, attempt.session_id);
  await env.DB.prepare("UPDATE daily_challenge_attempts SET score = ?1 WHERE id = ?2")
    .bind(stats.correct, attempt.id)
    .run();

  return json(request, {
    feedback: evaluation,
    progress: {
      answered: stats.answered,
      score: stats.correct,
      total: attempt.total_questions,
      readyToFinish: stats.answered === attempt.total_questions,
    },
  });
}

export async function finishDailyChallenge(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const body = await readJsonObject(request);
  const attemptId = requiredIdentifier(body, "attemptId");
  const attempt = await attemptForUser(env, attemptId, userId);

  if (attempt.completed_at) {
    return json(request, { challenge: await challengePayload(env, userId) });
  }
  assertAttemptPlayable(attempt);

  const stats = await answerStats(env, attempt.session_id);
  if (stats.answered !== attempt.total_questions) {
    throw new HttpError(
      409,
      `Réponds aux ${attempt.total_questions} questions avant de terminer la Marelle.`,
    );
  }

  const activityDate = currentAppDate();
  const dailyProgressId = crypto.randomUUID();
  const completionGuard = `EXISTS (
    SELECT 1 FROM daily_challenge_attempts
    WHERE id = ?1 AND user_id = ?2 AND completed_at IS NULL
  )`;

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE learning_sessions
       SET
         completed_at = CURRENT_TIMESTAMP,
         correct_answers = ?3,
         total_answers = ?4,
         xp_earned = ?5
       WHERE id = ?6 AND ${completionGuard}`,
    ).bind(attempt.id, userId, stats.correct, stats.answered, stats.xp_earned, attempt.session_id),
    env.DB.prepare(
      `INSERT INTO daily_progress (
        id,
        user_id,
        activity_date,
        earned_xp,
        completed_sessions,
        answered_questions,
        correct_answers,
        goal_reached
      )
      SELECT
        ?3,
        ?2,
        ?4,
        ?5,
        1,
        ?6,
        ?7,
        CASE WHEN ?5 >= (SELECT daily_goal_xp FROM users WHERE id = ?2) THEN 1 ELSE 0 END
      WHERE ${completionGuard}
      ON CONFLICT (user_id, activity_date) DO UPDATE SET
        earned_xp = daily_progress.earned_xp + excluded.earned_xp,
        completed_sessions = daily_progress.completed_sessions + 1,
        answered_questions = daily_progress.answered_questions + excluded.answered_questions,
        correct_answers = daily_progress.correct_answers + excluded.correct_answers,
        goal_reached = CASE
          WHEN daily_progress.earned_xp + excluded.earned_xp >=
            (SELECT daily_goal_xp FROM users WHERE id = ?2)
          THEN 1
          ELSE daily_progress.goal_reached
        END`,
    ).bind(
      attempt.id,
      userId,
      dailyProgressId,
      activityDate,
      stats.xp_earned,
      stats.answered,
      stats.correct,
    ),
    env.DB.prepare(
      `UPDATE users
       SET
         xp = xp + ?3,
         longest_streak = MAX(
           longest_streak,
           CASE
             WHEN last_activity_on = ?4 THEN current_streak
             WHEN last_activity_on = date(?4, '-1 day') THEN current_streak + 1
             ELSE 1
           END
         ),
         current_streak = CASE
           WHEN last_activity_on = ?4 THEN current_streak
           WHEN last_activity_on = date(?4, '-1 day') THEN current_streak + 1
           ELSE 1
         END,
         last_activity_on = ?4,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?2 AND ${completionGuard}`,
    ).bind(attempt.id, userId, stats.xp_earned, activityDate),
    env.DB.prepare(
      `UPDATE daily_challenge_attempts
       SET
         score = ?3,
         completed_at = CURRENT_TIMESTAMP,
         duration_seconds = MAX(0, unixepoch() - unixepoch(started_at))
       WHERE id = ?1 AND user_id = ?2 AND completed_at IS NULL`,
    ).bind(attempt.id, userId, stats.correct),
  ]);

  return json(request, { challenge: await challengePayload(env, userId) });
}
