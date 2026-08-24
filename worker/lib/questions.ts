import { HttpError } from "./http";

export type QuestionKind =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "numeric"
  | "fill_in_blank"
  | "ordering"
  | "matching";

export interface MatchingSubmission {
  answerItemId: string;
  promptPosition: number;
}

export interface AnswerSubmission {
  answerChoiceId: string | null;
  answerText: string | null;
  blankAnswers: string[] | null;
  matches: MatchingSubmission[] | null;
  orderedItemIds: string[] | null;
}

interface QuestionRow {
  answer_unit: string | null;
  expected_answer: string | null;
  explanation: string;
  kind: QuestionKind;
  numeric_tolerance: number | null;
}

interface ChoiceRow {
  id: string;
  is_correct: number;
  label: string;
}

interface ItemRow {
  accepted_answers: string;
  id: string;
  item_answer: string;
  item_prompt: string | null;
  position: number;
}

export interface AnswerEvaluation {
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
}

function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
}

function acceptedAnswers(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((answer): answer is string => typeof answer === "string")
      : [];
  } catch {
    return [];
  }
}

function numericValue(value: string, unit: string | null): number | null {
  let normalized = value.trim().toLocaleLowerCase("fr-FR");
  const normalizedUnit = unit ? normalizeAnswer(unit) : null;
  if (normalizedUnit && normalized.endsWith(normalizedUnit)) {
    normalized = normalized.slice(0, -normalizedUnit.length).trim();
  }
  normalized = normalized.replace(/\s+/g, "").replace(",", ".");
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function assertOnlySubmission(
  submission: AnswerSubmission,
  expected: keyof AnswerSubmission,
  message: string,
): void {
  const submitted = [
    ["answerChoiceId", submission.answerChoiceId],
    ["answerText", submission.answerText],
    ["blankAnswers", submission.blankAnswers],
    ["matches", submission.matches],
    ["orderedItemIds", submission.orderedItemIds],
  ].filter((entry) => entry[1] !== null);

  if (submitted.length !== 1 || submitted[0]?.[0] !== expected) {
    throw new HttpError(400, message);
  }
}

async function questionDetails(env: Env, questionId: string): Promise<{
  choices: ChoiceRow[];
  items: ItemRow[];
  question: QuestionRow;
}> {
  const question = await env.DB.prepare(
    `SELECT
      COALESCE(response_kind, kind) AS kind,
      explanation,
      expected_answer,
      numeric_tolerance,
      answer_unit
     FROM questions
     WHERE id = ?1`,
  )
    .bind(questionId)
    .first<QuestionRow>();

  if (!question) throw new HttpError(404, "Question introuvable.");

  const [choiceResult, itemResult] = await Promise.all([
    env.DB.prepare(
      `SELECT id, label, is_correct
       FROM answer_choices
       WHERE question_id = ?1
       ORDER BY position`,
    )
      .bind(questionId)
      .all<ChoiceRow>(),
    env.DB.prepare(
      `SELECT id, item_prompt, item_answer, accepted_answers, position
       FROM question_items
       WHERE question_id = ?1
       ORDER BY position`,
    )
      .bind(questionId)
      .all<ItemRow>(),
  ]);

  return {
    choices: choiceResult.results,
    items: itemResult.results,
    question,
  };
}

export async function evaluateAnswer(
  env: Env,
  questionId: string,
  submission: AnswerSubmission,
): Promise<AnswerEvaluation> {
  const { choices, items, question } = await questionDetails(env, questionId);
  const result = (isCorrect: boolean, correctAnswer: string): AnswerEvaluation => ({
    correctAnswer,
    explanation: question.explanation,
    isCorrect,
  });

  if (question.kind === "multiple_choice" || question.kind === "true_false") {
    assertOnlySubmission(
      submission,
      "answerChoiceId",
      "Cette question attend un choix de réponse.",
    );
    const selectedChoice = choices.find((choice) => choice.id === submission.answerChoiceId);
    if (!selectedChoice) {
      throw new HttpError(400, "La réponse choisie n’appartient pas à cette question.");
    }
    const correctChoice = choices.find((choice) => choice.is_correct === 1);
    if (!correctChoice) throw new Error(`Question ${questionId} has no correct choice`);
    return result(selectedChoice.is_correct === 1, correctChoice.label);
  }

  if (question.kind === "short_answer") {
    assertOnlySubmission(
      submission,
      "answerText",
      "Cette question attend une réponse écrite.",
    );
    if (!question.expected_answer || submission.answerText === null) {
      throw new Error(`Question ${questionId} has no expected answer`);
    }
    return result(
      normalizeAnswer(submission.answerText) === normalizeAnswer(question.expected_answer),
      question.expected_answer,
    );
  }

  if (question.kind === "numeric") {
    assertOnlySubmission(
      submission,
      "answerText",
      "Cette question attend une réponse numérique.",
    );
    if (!question.expected_answer || submission.answerText === null) {
      throw new Error(`Question ${questionId} has no numeric answer`);
    }
    const expected = numericValue(question.expected_answer, question.answer_unit);
    const submitted = numericValue(submission.answerText, question.answer_unit);
    if (expected === null) throw new Error(`Question ${questionId} has an invalid numeric answer`);
    return result(
      submitted !== null && Math.abs(submitted - expected) <= (question.numeric_tolerance ?? 0),
      `${question.expected_answer}${question.answer_unit ? ` ${question.answer_unit}` : ""}`,
    );
  }

  if (question.kind === "fill_in_blank") {
    assertOnlySubmission(
      submission,
      "blankAnswers",
      "Cette question attend une réponse pour chaque blanc.",
    );
    if (!items.length || !submission.blankAnswers) {
      throw new Error(`Question ${questionId} has no blank answers`);
    }
    if (submission.blankAnswers.length !== items.length) {
      throw new HttpError(400, "Tous les blancs doivent recevoir une réponse.");
    }
    const isCorrect = items.every((item, index) => {
      const accepted = [item.item_answer, ...acceptedAnswers(item.accepted_answers)].map(normalizeAnswer);
      return accepted.includes(normalizeAnswer(submission.blankAnswers![index] ?? ""));
    });
    return result(isCorrect, items.map((item) => item.item_answer).join(" · "));
  }

  if (question.kind === "ordering") {
    assertOnlySubmission(
      submission,
      "orderedItemIds",
      "Cette question attend une liste ordonnée.",
    );
    const submitted = submission.orderedItemIds;
    if (!items.length || !submitted) throw new Error(`Question ${questionId} has no ordering items`);
    if (
      submitted.length !== items.length ||
      new Set(submitted).size !== submitted.length ||
      submitted.some((id) => !items.some((item) => item.id === id))
    ) {
      throw new HttpError(400, "La liste ordonnée est invalide.");
    }
    return result(
      submitted.every((id, index) => id === items[index]?.id),
      items.map((item) => item.item_answer).join(" → "),
    );
  }

  assertOnlySubmission(submission, "matches", "Cette question attend des associations.");
  const submitted = submission.matches;
  if (!items.length || !submitted) throw new Error(`Question ${questionId} has no matching items`);
  const promptPositions = submitted.map((match) => match.promptPosition);
  const answerIds = submitted.map((match) => match.answerItemId);
  if (
    submitted.length !== items.length ||
    new Set(promptPositions).size !== submitted.length ||
    new Set(answerIds).size !== submitted.length ||
    submitted.some(
      (match) =>
        !items.some((item) => item.position === match.promptPosition) ||
        !items.some((item) => item.id === match.answerItemId),
    )
  ) {
    throw new HttpError(400, "Les associations proposées sont invalides.");
  }
  return result(
    submitted.every(
      (match) => items.find((item) => item.position === match.promptPosition)?.id === match.answerItemId,
    ),
    items.map((item) => `${item.item_prompt} → ${item.item_answer}`).join(" · "),
  );
}

function storedAnswer(answer: AnswerSubmission): string | null {
  if (answer.answerText !== null) return answer.answerText;
  if (answer.blankAnswers !== null) return JSON.stringify({ blankAnswers: answer.blankAnswers });
  if (answer.orderedItemIds !== null) return JSON.stringify({ orderedItemIds: answer.orderedItemIds });
  if (answer.matches !== null) return JSON.stringify({ matches: answer.matches });
  return null;
}

export async function recordAnswer(
  env: Env,
  input: {
    answer: AnswerSubmission;
    evaluation: AnswerEvaluation;
    questionId: string;
    responseTimeMs: number | null;
    sessionId: string;
    userId: string;
  },
): Promise<void> {
  const answerId = crypto.randomUUID();
  const correctValue = input.evaluation.isCorrect ? 1 : 0;
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO user_answers (
        id,
        session_id,
        user_id,
        question_id,
        answer_choice_id,
        answer_text,
        is_correct,
        response_time_ms
      )
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
      WHERE NOT EXISTS (
        SELECT 1 FROM user_answers WHERE session_id = ?2 AND question_id = ?4
      )`,
    ).bind(
      answerId,
      input.sessionId,
      input.userId,
      input.questionId,
      input.answer.answerChoiceId,
      storedAnswer(input.answer),
      correctValue,
      input.responseTimeMs,
    ),
    env.DB.prepare(
      `INSERT INTO user_question_progress (
        user_id,
        question_id,
        status,
        attempts,
        correct_answers,
        last_answered_at,
        next_review_at
      )
      SELECT
        ?1,
        ?2,
        CASE WHEN ?3 = 1 THEN 'learning' ELSE 'review' END,
        1,
        ?3,
        CURRENT_TIMESTAMP,
        CASE WHEN ?3 = 1 THEN datetime('now', '+2 days') ELSE datetime('now', '+1 day') END
      WHERE EXISTS (SELECT 1 FROM user_answers WHERE id = ?4)
      ON CONFLICT (user_id, question_id) DO UPDATE SET
        status = CASE
          WHEN ?3 = 0 THEN 'review'
          WHEN user_question_progress.correct_answers + 1 >= 3 THEN 'mastered'
          ELSE 'learning'
        END,
        attempts = user_question_progress.attempts + 1,
        correct_answers = user_question_progress.correct_answers + ?3,
        last_answered_at = CURRENT_TIMESTAMP,
        next_review_at = CASE
          WHEN ?3 = 1 THEN datetime('now', '+2 days')
          ELSE datetime('now', '+1 day')
        END`,
    ).bind(input.userId, input.questionId, correctValue, answerId),
  ]);

  if (results[0]?.meta.changes !== 1) {
    throw new HttpError(409, "Cette question a déjà reçu une réponse.");
  }
}
