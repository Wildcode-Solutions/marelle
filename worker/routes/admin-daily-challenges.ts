import { currentAppDate } from "../lib/date";
import { HttpError, json, readJsonObject } from "../lib/http";

type DailyChallengeStoredStatus = "draft" | "published";
type DailyChallengeEffectiveStatus = "draft" | "scheduled" | "active" | "finished";
type QuestionKind =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "numeric"
  | "fill_in_blank"
  | "ordering"
  | "matching";

interface ChallengeJoinedRow {
  created_at: string;
  difficulty: number;
  id: string;
  kind: QuestionKind;
  participant_count: number;
  position: number;
  prompt: string;
  publication_date: string;
  question_id: string;
  status: DailyChallengeStoredStatus;
  subject_icon: string;
  subject_id: string;
  subject_name: string;
  theme_id: string;
  theme_title: string;
  title: string;
  updated_at: string;
}

interface QuestionLibraryRow {
  difficulty: number;
  id: string;
  kind: QuestionKind;
  prompt: string;
  school_level_id: string;
  school_level_label: string;
  subject_icon: string;
  subject_id: string;
  subject_name: string;
  theme_id: string;
  theme_title: string;
}

interface DailyChallengeInput {
  publicationDate: string;
  questionIds: string[];
  status: DailyChallengeStoredStatus;
  title: string;
}

interface CountRow {
  count: number;
}

function effectiveStatus(
  storedStatus: DailyChallengeStoredStatus,
  publicationDate: string,
): DailyChallengeEffectiveStatus {
  if (storedStatus === "draft") return "draft";
  const today = currentAppDate();
  if (publicationDate > today) return "scheduled";
  if (publicationDate < today) return "finished";
  return "active";
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function challengeInput(body: Record<string, unknown>): DailyChallengeInput {
  const publicationDate = body.publicationDate;
  const rawTitle = body.title;
  const status = body.status;
  const rawQuestionIds = body.questionIds;

  if (typeof publicationDate !== "string" || !isIsoDate(publicationDate)) {
    throw new HttpError(400, "La date de publication est invalide.");
  }
  if (typeof rawTitle !== "string") {
    throw new HttpError(400, "Le titre est obligatoire.");
  }
  const title = rawTitle.trim().replace(/\s+/g, " ");
  if (title.length < 3 || title.length > 120) {
    throw new HttpError(400, "Le titre doit contenir entre 3 et 120 caractères.");
  }
  if (status !== "draft" && status !== "published") {
    throw new HttpError(400, "Le statut de la Marelle est invalide.");
  }
  if (
    !Array.isArray(rawQuestionIds) ||
    rawQuestionIds.length < 3 ||
    rawQuestionIds.length > 5 ||
    rawQuestionIds.some(
      (questionId) => typeof questionId !== "string" || questionId.length < 1 || questionId.length > 100,
    )
  ) {
    throw new HttpError(400, "Une Marelle doit contenir entre 3 et 5 questions.");
  }
  const questionIds = rawQuestionIds as string[];
  if (new Set(questionIds).size !== questionIds.length) {
    throw new HttpError(400, "Une question ne peut apparaître qu’une fois dans une Marelle.");
  }

  return { publicationDate, questionIds, status, title };
}

async function assertPublishedQuestions(env: Env, questionIds: string[]): Promise<void> {
  const placeholders = questionIds.map((_, index) => `?${index + 1}`).join(", ");
  const { results } = await env.DB.prepare(
    `SELECT id FROM questions WHERE status = 'published' AND id IN (${placeholders})`,
  )
    .bind(...questionIds)
    .all<{ id: string }>();

  if (results.length !== questionIds.length) {
    throw new HttpError(400, "Toutes les questions sélectionnées doivent être publiées.");
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

async function challengeRows(env: Env, challengeId: string | null = null) {
  const where = challengeId ? "WHERE dc.id = ?1" : "";
  const statement = env.DB.prepare(
    `SELECT
      dc.id,
      dc.publication_date,
      dc.title,
      dc.status,
      dc.created_at,
      dc.updated_at,
      dcq.position,
      q.id AS question_id,
      q.prompt,
      COALESCE(q.response_kind, q.kind) AS kind,
      q.difficulty,
      c.id AS theme_id,
      c.title AS theme_title,
      s.id AS subject_id,
      s.name AS subject_name,
      s.icon AS subject_icon,
      (SELECT COUNT(*) FROM daily_challenge_attempts dca
       WHERE dca.daily_challenge_id = dc.id) AS participant_count
     FROM daily_challenges dc
     JOIN daily_challenge_questions dcq ON dcq.daily_challenge_id = dc.id
     JOIN questions q ON q.id = dcq.question_id
     JOIN chapters c ON c.id = q.chapter_id
     JOIN subjects s ON s.id = c.subject_id
     ${where}
     ORDER BY dc.publication_date DESC, dc.created_at DESC, dcq.position`,
  );
  return challengeId
    ? (await statement.bind(challengeId).all<ChallengeJoinedRow>()).results
    : (await statement.all<ChallengeJoinedRow>()).results;
}

function groupChallenges(rows: ChallengeJoinedRow[]) {
  const challenges = new Map<
    string,
    {
      createdAt: string;
      date: string;
      effectiveStatus: DailyChallengeEffectiveStatus;
      id: string;
      participantCount: number;
      questions: Array<{
        difficulty: number;
        id: string;
        kind: QuestionJoinedKind;
        position: number;
        prompt: string;
        subject: { icon: string; id: string; name: string };
        theme: { id: string; title: string };
      }>;
      questionCount: number;
      status: DailyChallengeStoredStatus;
      title: string;
      updatedAt: string;
    }
  >();

  for (const row of rows) {
    const challenge = challenges.get(row.id) ?? {
      id: row.id,
      date: row.publication_date,
      title: row.title,
      status: row.status,
      effectiveStatus: effectiveStatus(row.status, row.publication_date),
      questionCount: 0,
      participantCount: row.participant_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      questions: [],
    };
    challenge.questions.push({
      id: row.question_id,
      prompt: row.prompt,
      kind: row.kind,
      difficulty: row.difficulty,
      position: row.position,
      theme: { id: row.theme_id, title: row.theme_title },
      subject: { id: row.subject_id, name: row.subject_name, icon: row.subject_icon },
    });
    challenge.questionCount = challenge.questions.length;
    challenges.set(row.id, challenge);
  }

  return Array.from(challenges.values());
}

type QuestionJoinedKind = ChallengeJoinedRow["kind"];

export async function adminDailyChallenges(request: Request, env: Env): Promise<Response> {
  return json(request, { challenges: groupChallenges(await challengeRows(env)) });
}

export async function adminDailyQuestionLibrary(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const conditions = ["q.status = 'published'"];
  const bindings: Array<string | number> = [];

  const addFilter = (column: string, value: string | null): void => {
    if (!value) return;
    bindings.push(value);
    conditions.push(`${column} = ?${bindings.length}`);
  };
  addFilter("s.id", url.searchParams.get("subjectId"));
  addFilter("c.school_level_id", url.searchParams.get("schoolLevelId"));
  addFilter("COALESCE(q.response_kind, q.kind)", url.searchParams.get("kind"));

  const rawDifficulty = url.searchParams.get("difficulty");
  if (rawDifficulty) {
    const difficulty = Number(rawDifficulty);
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      throw new HttpError(400, "Le filtre de difficulté est invalide.");
    }
    bindings.push(difficulty);
    conditions.push(`q.difficulty = ?${bindings.length}`);
  }

  const search = url.searchParams.get("search")?.trim();
  if (search) {
    if (search.length > 100) throw new HttpError(400, "La recherche est trop longue.");
    bindings.push(`%${search}%`);
    conditions.push(`q.prompt LIKE ?${bindings.length}`);
  }

  const statement = env.DB.prepare(
    `SELECT
      q.id,
      q.prompt,
      COALESCE(q.response_kind, q.kind) AS kind,
      q.difficulty,
      c.id AS theme_id,
      c.title AS theme_title,
      c.school_level_id,
      l.label AS school_level_label,
      s.id AS subject_id,
      s.name AS subject_name,
      s.icon AS subject_icon
     FROM questions q
     JOIN chapters c ON c.id = q.chapter_id
     JOIN school_levels l ON l.id = c.school_level_id
     JOIN subjects s ON s.id = c.subject_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY s.name, l.position, c.position, q.difficulty, q.created_at
     LIMIT 300`,
  );
  const { results } = bindings.length
    ? await statement.bind(...bindings).all<QuestionLibraryRow>()
    : await statement.all<QuestionLibraryRow>();

  return json(request, {
    questions: results.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      kind: row.kind,
      difficulty: row.difficulty,
      theme: { id: row.theme_id, title: row.theme_title },
      schoolLevel: { id: row.school_level_id, label: row.school_level_label },
      subject: { id: row.subject_id, name: row.subject_name, icon: row.subject_icon },
    })),
  });
}

async function saveChallenge(
  env: Env,
  challengeId: string,
  input: DailyChallengeInput,
  mode: "create" | "update",
): Promise<void> {
  await assertPublishedQuestions(env, input.questionIds);

  const statements: D1PreparedStatement[] = [];
  if (mode === "create") {
    statements.push(
      env.DB.prepare(
        `INSERT INTO daily_challenges (id, publication_date, title, status)
         VALUES (?1, ?2, ?3, 'draft')`,
      ).bind(challengeId, input.publicationDate, input.title),
    );
  } else {
    statements.push(
      env.DB.prepare(
        `UPDATE daily_challenges
         SET publication_date = ?1, title = ?2, status = 'draft', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?3`,
      ).bind(input.publicationDate, input.title, challengeId),
      env.DB.prepare(
        "DELETE FROM daily_challenge_questions WHERE daily_challenge_id = ?1",
      ).bind(challengeId),
    );
  }

  input.questionIds.forEach((questionId, index) => {
    statements.push(
      env.DB.prepare(
        `INSERT INTO daily_challenge_questions (daily_challenge_id, question_id, position)
         VALUES (?1, ?2, ?3)`,
      ).bind(challengeId, questionId, index + 1),
    );
  });
  statements.push(
    env.DB.prepare(
      `UPDATE daily_challenges
       SET status = ?1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?2`,
    ).bind(input.status, challengeId),
  );

  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Une Marelle existe déjà pour cette date.");
    }
    throw error;
  }
}

async function challengeParticipationCount(env: Env, challengeId: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM daily_challenge_attempts WHERE daily_challenge_id = ?1",
  )
    .bind(challengeId)
    .first<CountRow>();
  return row?.count ?? 0;
}

export async function createAdminDailyChallenge(
  request: Request,
  env: Env,
): Promise<Response> {
  const input = challengeInput(await readJsonObject(request, 65_536));
  const challengeId = crypto.randomUUID();
  await saveChallenge(env, challengeId, input, "create");
  const challenge = groupChallenges(await challengeRows(env, challengeId))[0];
  if (!challenge) throw new Error("Created daily challenge could not be reloaded");
  return json(request, { challenge }, { status: 201 });
}

export async function updateAdminDailyChallenge(
  request: Request,
  env: Env,
  challengeId: string,
): Promise<Response> {
  if ((await challengeRows(env, challengeId)).length === 0) {
    throw new HttpError(404, "Marelle introuvable.");
  }
  if ((await challengeParticipationCount(env, challengeId)) > 0) {
    throw new HttpError(409, "Une Marelle déjà commencée ne peut plus être modifiée.");
  }

  const input = challengeInput(await readJsonObject(request, 65_536));
  await saveChallenge(env, challengeId, input, "update");
  const challenge = groupChallenges(await challengeRows(env, challengeId))[0];
  if (!challenge) throw new Error("Updated daily challenge could not be reloaded");
  return json(request, { challenge });
}

export async function deleteAdminDailyChallenge(
  request: Request,
  env: Env,
  challengeId: string,
): Promise<Response> {
  const existing = await env.DB.prepare("SELECT id FROM daily_challenges WHERE id = ?1")
    .bind(challengeId)
    .first<{ id: string }>();
  if (!existing) throw new HttpError(404, "Marelle introuvable.");
  if ((await challengeParticipationCount(env, challengeId)) > 0) {
    throw new HttpError(409, "Une Marelle ayant des participants ne peut pas être supprimée.");
  }

  await env.DB.prepare("DELETE FROM daily_challenges WHERE id = ?1").bind(challengeId).run();
  return json(request, { success: true });
}
