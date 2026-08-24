import { HttpError, json, readJsonObject } from "../lib/http";

type QuestionKind =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "numeric"
  | "fill_in_blank"
  | "ordering"
  | "matching";
type QuestionStatus = "draft" | "published" | "archived";

interface ThemeRow {
  id: string;
  subject_id: string;
  subject_name: string;
  subject_icon: string;
  school_level_id: string;
  school_level_label: string;
  slug: string;
  title: string;
  summary: string | null;
  position: number;
  is_active: number;
  question_count: number;
}

interface QuestionJoinedRow {
  id: string;
  chapter_id: string;
  chapter_title: string;
  kind: QuestionKind;
  prompt: string;
  explanation: string;
  expected_answer: string | null;
  numeric_tolerance: number | null;
  answer_unit: string | null;
  difficulty: number;
  xp_reward: number;
  status: QuestionStatus;
  choice_id: string | null;
  choice_label: string | null;
  choice_is_correct: number | null;
  choice_position: number | null;
  item_id: string | null;
  item_prompt: string | null;
  item_answer: string | null;
  item_accepted_answers: string | null;
  item_position: number | null;
}

interface ChoiceInput {
  isCorrect: boolean;
  label: string;
}

interface QuestionItemInput {
  acceptedAnswers: string[];
  answer: string;
  prompt: string;
}

interface QuestionInput {
  choices: ChoiceInput[];
  difficulty: number;
  expectedAnswer: string | null;
  numericTolerance: number | null;
  answerUnit: string | null;
  explanation: string;
  kind: QuestionKind;
  prompt: string;
  status: QuestionStatus;
  themeId: string;
  xpReward: number;
  items: QuestionItemInput[];
}

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string") throw new HttpError(400, `Le champ ${field} est obligatoire.`);
  return value.trim();
}

function optionalString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new HttpError(400, `Le champ ${field} est invalide.`);
  return value.trim();
}

function integerValue(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new HttpError(400, `Le champ ${field} doit être compris entre ${minimum} et ${maximum}.`);
  }
  return value as number;
}

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new HttpError(400, `Le champ ${field} est invalide.`);
  return value;
}

function pagination(url: URL): { limit: number; offset: number } {
  const rawLimit = url.searchParams.get("limit");
  const rawOffset = url.searchParams.get("offset");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new HttpError(400, "Les paramètres de pagination sont invalides.");
  }
  return { limit, offset };
}

function toTheme(row: ThemeRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary ?? "",
    position: row.position,
    isActive: row.is_active === 1,
    questionCount: row.question_count,
    subject: {
      id: row.subject_id,
      name: row.subject_name,
      icon: row.subject_icon,
    },
    schoolLevel: {
      id: row.school_level_id,
      label: row.school_level_label,
    },
  };
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "theme";
}

async function uniqueThemeSlug(
  env: Env,
  subjectId: string,
  schoolLevelId: string,
  title: string,
  currentThemeId: string | null = null,
): Promise<string> {
  const base = slugify(title);
  const existing = await env.DB.prepare(
    `SELECT id FROM chapters
     WHERE subject_id = ?1 AND school_level_id = ?2 AND slug = ?3 AND (?4 IS NULL OR id <> ?4)`,
  )
    .bind(subjectId, schoolLevelId, base, currentThemeId)
    .first<{ id: string }>();
  return existing ? `${base}-${crypto.randomUUID().slice(0, 8)}` : base;
}

async function themeById(env: Env, themeId: string): Promise<ThemeRow | null> {
  return env.DB.prepare(
    `SELECT
      c.id,
      c.subject_id,
      s.name AS subject_name,
      s.icon AS subject_icon,
      c.school_level_id,
      l.label AS school_level_label,
      c.slug,
      c.title,
      c.summary,
      c.position,
      c.is_active,
      COUNT(q.id) AS question_count
     FROM chapters c
     JOIN subjects s ON s.id = c.subject_id
     JOIN school_levels l ON l.id = c.school_level_id
     LEFT JOIN questions q ON q.chapter_id = c.id
     WHERE c.id = ?1
     GROUP BY c.id`,
  )
    .bind(themeId)
    .first<ThemeRow>();
}

async function validateThemeRelations(
  env: Env,
  subjectId: string,
  schoolLevelId: string,
): Promise<void> {
  const results = await env.DB.batch([
    env.DB.prepare("SELECT id FROM subjects WHERE id = ?1").bind(subjectId),
    env.DB.prepare("SELECT id FROM school_levels WHERE id = ?1").bind(schoolLevelId),
  ]);
  if (!results[0]?.results[0]) throw new HttpError(400, "La matière sélectionnée est invalide.");
  if (!results[1]?.results[0]) throw new HttpError(400, "Le niveau scolaire sélectionné est invalide.");
}

function themeInput(body: Record<string, unknown>) {
  const title = requiredString(body, "title");
  const summary = optionalString(body, "summary");
  const subjectId = requiredString(body, "subjectId");
  const schoolLevelId = requiredString(body, "schoolLevelId");
  const position = integerValue(body.position, "position", 0, 10_000);
  const isActive = booleanValue(body.isActive, "isActive");

  if (title.length < 3 || title.length > 120) {
    throw new HttpError(400, "Le titre du thème doit contenir entre 3 et 120 caractères.");
  }
  if (summary.length > 500) {
    throw new HttpError(400, "Le résumé ne peut pas dépasser 500 caractères.");
  }
  return { title, summary, subjectId, schoolLevelId, position, isActive };
}

export async function adminCatalog(request: Request, env: Env): Promise<Response> {
  const results = await env.DB.batch([
    env.DB.prepare("SELECT id, label FROM school_levels ORDER BY position"),
    env.DB.prepare(
      "SELECT id, name, short_name, icon, color FROM subjects ORDER BY name COLLATE NOCASE",
    ),
  ]);

  return json(request, {
    schoolLevels: results[0]?.results ?? [],
    subjects: (results[1]?.results ?? []).map((subject) => {
      if (typeof subject !== "object" || subject === null) return subject;
      return {
        id: "id" in subject ? subject.id : "",
        name: "name" in subject ? subject.name : "",
        shortName: "short_name" in subject ? subject.short_name : "",
        icon: "icon" in subject ? subject.icon : "",
        color: "color" in subject ? subject.color : "",
      };
    }),
  });
}

export async function adminThemes(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { limit, offset } = pagination(url);
  const result = await env.DB.prepare(
    `SELECT
      c.id,
      c.subject_id,
      s.name AS subject_name,
      s.icon AS subject_icon,
      c.school_level_id,
      l.label AS school_level_label,
      c.slug,
      c.title,
      c.summary,
      c.position,
      c.is_active,
      COUNT(q.id) AS question_count
     FROM chapters c
     JOIN subjects s ON s.id = c.subject_id
     JOIN school_levels l ON l.id = c.school_level_id
     LEFT JOIN questions q ON q.chapter_id = c.id
     GROUP BY c.id
     ORDER BY s.name COLLATE NOCASE, l.position, c.position, c.title COLLATE NOCASE
     LIMIT ?1 OFFSET ?2`,
  )
    .bind(limit + 1, offset)
    .all<ThemeRow>();

  return json(request, {
    themes: result.results.slice(0, limit).map(toTheme),
    pagination: { limit, offset, hasMore: result.results.length > limit },
  });
}

export async function createAdminTheme(request: Request, env: Env): Promise<Response> {
  const input = themeInput(await readJsonObject(request));
  await validateThemeRelations(env, input.subjectId, input.schoolLevelId);
  const id = crypto.randomUUID();
  const slug = await uniqueThemeSlug(env, input.subjectId, input.schoolLevelId, input.title);

  await env.DB.prepare(
    `INSERT INTO chapters (
      id, subject_id, school_level_id, slug, title, summary, position, is_active
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(
      id,
      input.subjectId,
      input.schoolLevelId,
      slug,
      input.title,
      input.summary || null,
      input.position,
      input.isActive ? 1 : 0,
    )
    .run();

  const created = await themeById(env, id);
  if (!created) throw new Error("Created theme could not be reloaded");
  return json(request, { theme: toTheme(created) }, { status: 201 });
}

export async function updateAdminTheme(
  request: Request,
  env: Env,
  themeId: string,
): Promise<Response> {
  const current = await themeById(env, themeId);
  if (!current) throw new HttpError(404, "Thème introuvable.");
  const input = themeInput(await readJsonObject(request));
  await validateThemeRelations(env, input.subjectId, input.schoolLevelId);
  const slug = await uniqueThemeSlug(
    env,
    input.subjectId,
    input.schoolLevelId,
    input.title,
    themeId,
  );

  await env.DB.prepare(
    `UPDATE chapters
     SET subject_id = ?1,
         school_level_id = ?2,
         slug = ?3,
         title = ?4,
         summary = ?5,
         position = ?6,
         is_active = ?7
     WHERE id = ?8`,
  )
    .bind(
      input.subjectId,
      input.schoolLevelId,
      slug,
      input.title,
      input.summary || null,
      input.position,
      input.isActive ? 1 : 0,
      themeId,
    )
    .run();

  const updated = await themeById(env, themeId);
  if (!updated) throw new Error("Updated theme could not be reloaded");
  return json(request, { theme: toTheme(updated) });
}

function questionInput(body: Record<string, unknown>): QuestionInput {
  const themeId = requiredString(body, "themeId");
  const prompt = requiredString(body, "prompt");
  const explanation = optionalString(body, "explanation");
  const kind = body.kind;
  const status = body.status;
  const difficulty = integerValue(body.difficulty, "difficulty", 1, 5);
  const xpReward = integerValue(body.xpReward, "xpReward", 1, 100);

  const allowedKinds: QuestionKind[] = [
    "multiple_choice",
    "true_false",
    "short_answer",
    "numeric",
    "fill_in_blank",
    "ordering",
    "matching",
  ];
  if (typeof kind !== "string" || !allowedKinds.includes(kind as QuestionKind)) {
    throw new HttpError(400, "Le type de question est invalide.");
  }
  if (status !== "draft" && status !== "published" && status !== "archived") {
    throw new HttpError(400, "Le statut de la question est invalide.");
  }
  if (prompt.length < 3 || prompt.length > 500) {
    throw new HttpError(400, "La question doit contenir entre 3 et 500 caractères.");
  }
  if (explanation.length > 1_000) {
    throw new HttpError(400, "L’explication ne peut pas dépasser 1 000 caractères.");
  }

  const common = {
    themeId,
    prompt,
    explanation,
    kind: kind as QuestionKind,
    status: status as QuestionStatus,
    difficulty,
    xpReward,
  };

  if (kind === "short_answer") {
    const expectedAnswer = requiredString(body, "expectedAnswer");
    if (!expectedAnswer || expectedAnswer.length > 200) {
      throw new HttpError(400, "La réponse attendue doit contenir entre 1 et 200 caractères.");
    }
    return {
      ...common,
      expectedAnswer,
      numericTolerance: null,
      answerUnit: null,
      choices: [],
      items: [],
    };
  }

  if (kind === "numeric") {
    const expectedAnswer = requiredString(body, "expectedAnswer").replace(",", ".");
    const numericValue = Number(expectedAnswer);
    const toleranceValue = body.numericTolerance;
    const numericTolerance = toleranceValue === undefined || toleranceValue === null
      ? 0
      : Number(toleranceValue);
    const answerUnit = optionalString(body, "answerUnit");
    if (!expectedAnswer || !Number.isFinite(numericValue)) {
      throw new HttpError(400, "La réponse numérique attendue est invalide.");
    }
    if (!Number.isFinite(numericTolerance) || numericTolerance < 0 || numericTolerance > 1_000_000_000) {
      throw new HttpError(400, "La tolérance numérique doit être comprise entre 0 et 1 000 000 000.");
    }
    if (answerUnit.length > 30) {
      throw new HttpError(400, "L’unité ne peut pas dépasser 30 caractères.");
    }
    return {
      ...common,
      expectedAnswer: String(numericValue),
      numericTolerance,
      answerUnit: answerUnit || null,
      choices: [],
      items: [],
    };
  }

  if (kind === "fill_in_blank" || kind === "ordering" || kind === "matching") {
    if (!Array.isArray(body.items)) {
      throw new HttpError(400, "Les éléments de la question sont obligatoires.");
    }
    const items = body.items.map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        throw new HttpError(400, "Un élément de question est invalide.");
      }
      const itemPrompt = "prompt" in item && typeof item.prompt === "string"
        ? item.prompt.trim()
        : "";
      const answer = "answer" in item && typeof item.answer === "string"
        ? item.answer.trim()
        : "";
      const rawAcceptedAnswers = "acceptedAnswers" in item ? item.acceptedAnswers : [];
      if (!Array.isArray(rawAcceptedAnswers)) {
        throw new HttpError(400, "Les variantes de réponse sont invalides.");
      }
      const acceptedAnswers = rawAcceptedAnswers.map((acceptedAnswer) => {
        if (typeof acceptedAnswer !== "string") {
          throw new HttpError(400, "Une variante de réponse est invalide.");
        }
        return acceptedAnswer.trim();
      });
      if (
        !answer ||
        answer.length > 300 ||
        itemPrompt.length > 200 ||
        acceptedAnswers.length > 5 ||
        acceptedAnswers.some((acceptedAnswer) => !acceptedAnswer || acceptedAnswer.length > 200)
      ) {
        throw new HttpError(400, "Un élément de question est invalide.");
      }
      return { prompt: itemPrompt, answer, acceptedAnswers };
    });

    if (kind === "fill_in_blank") {
      const placeholders = prompt.match(/\{\{\d+\}\}/g) ?? [];
      const expectedPlaceholders = items.map((_, index) => `{{${index + 1}}}`);
      if (
        items.length < 1 ||
        items.length > 6 ||
        placeholders.length !== items.length ||
        placeholders.some((placeholder, index) => placeholder !== expectedPlaceholders[index])
      ) {
        throw new HttpError(
          400,
          "Utilise les repères {{1}}, {{2}}, etc. dans l’ordre, avec une réponse par trou.",
        );
      }
    } else if (items.length < 2 || items.length > 8) {
      throw new HttpError(400, "Une question d’ordre ou d’association doit contenir 2 à 8 éléments.");
    }
    if (kind === "matching" && items.some((item) => !item.prompt)) {
      throw new HttpError(400, "Chaque association doit contenir deux éléments.");
    }

    return {
      ...common,
      expectedAnswer: null,
      numericTolerance: null,
      answerUnit: null,
      choices: [],
      items,
    };
  }

  if (!Array.isArray(body.choices)) {
    throw new HttpError(400, "Les propositions de réponse sont obligatoires.");
  }
  const choices = body.choices.map((choice) => {
    if (typeof choice !== "object" || choice === null || Array.isArray(choice)) {
      throw new HttpError(400, "Une proposition de réponse est invalide.");
    }
    const label = "label" in choice && typeof choice.label === "string" ? choice.label.trim() : "";
    const isCorrect = "isCorrect" in choice ? choice.isCorrect : null;
    if (!label || label.length > 120 || typeof isCorrect !== "boolean") {
      throw new HttpError(400, "Une proposition de réponse est invalide.");
    }
    return { label, isCorrect };
  });

  const expectedCount = kind === "true_false" ? 2 : null;
  if (
    choices.length < 2 ||
    choices.length > 6 ||
    (expectedCount !== null && choices.length !== expectedCount)
  ) {
    throw new HttpError(
      400,
      kind === "true_false"
        ? "Une question vrai/faux doit contenir deux réponses."
        : "Un QCM doit contenir entre deux et six réponses.",
    );
  }
  if (choices.filter((choice) => choice.isCorrect).length !== 1) {
    throw new HttpError(400, "Une seule proposition doit être marquée comme correcte.");
  }

  return {
    ...common,
    expectedAnswer: null,
    numericTolerance: null,
    answerUnit: null,
    choices,
    items: [],
  };
}

function acceptedAnswers(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((answer): answer is string => typeof answer === "string")
      : [];
  } catch {
    return [];
  }
}

function questionFromRows(rows: QuestionJoinedRow[]) {
  const first = rows[0];
  if (!first) return null;
  return {
    id: first.id,
    themeId: first.chapter_id,
    themeTitle: first.chapter_title,
    kind: first.kind,
    prompt: first.prompt,
    explanation: first.explanation,
    expectedAnswer: first.expected_answer,
    numericTolerance: first.numeric_tolerance,
    answerUnit: first.answer_unit,
    difficulty: first.difficulty,
    xpReward: first.xp_reward,
    status: first.status,
    choices: rows
      .filter((row) => row.choice_id !== null && row.choice_label !== null)
      .map((row) => ({
        id: row.choice_id as string,
        label: row.choice_label as string,
        isCorrect: row.choice_is_correct === 1,
        position: row.choice_position ?? 0,
      })),
    items: rows
      .filter((row) => row.item_id !== null && row.item_answer !== null)
      .map((row) => ({
        id: row.item_id as string,
        prompt: row.item_prompt ?? "",
        answer: row.item_answer as string,
        acceptedAnswers: acceptedAnswers(row.item_accepted_answers),
        position: row.item_position ?? 0,
      })),
  };
}

function groupQuestions(rows: QuestionJoinedRow[]) {
  const grouped = new Map<string, QuestionJoinedRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.id);
    if (current) current.push(row);
    else grouped.set(row.id, [row]);
  }
  return Array.from(grouped.values(), (questionRows) => questionFromRows(questionRows));
}

async function questionRows(
  env: Env,
  where: "theme" | "question",
  id: string,
): Promise<QuestionJoinedRow[]> {
  const condition = where === "theme"
    ? `q.id IN (
        SELECT id FROM questions
        WHERE chapter_id = ?1
        ORDER BY created_at DESC
        LIMIT 100
      )`
    : "q.id = ?1";
  const result = await env.DB.prepare(
    `SELECT
      q.id,
      q.chapter_id,
      c.title AS chapter_title,
      COALESCE(q.response_kind, q.kind) AS kind,
      q.prompt,
      q.explanation,
      q.expected_answer,
      q.numeric_tolerance,
      q.answer_unit,
      q.difficulty,
      q.xp_reward,
      q.status,
      a.id AS choice_id,
      a.label AS choice_label,
      a.is_correct AS choice_is_correct,
      a.position AS choice_position,
      i.id AS item_id,
      i.item_prompt,
      i.item_answer,
      i.accepted_answers AS item_accepted_answers,
      i.position AS item_position
     FROM questions q
     JOIN chapters c ON c.id = q.chapter_id
     LEFT JOIN answer_choices a ON a.question_id = q.id
     LEFT JOIN question_items i ON i.question_id = q.id
     WHERE ${condition}
     ORDER BY q.created_at DESC, COALESCE(a.position, i.position)`,
  )
    .bind(id)
    .all<QuestionJoinedRow>();
  return result.results;
}

export async function adminQuestions(request: Request, env: Env): Promise<Response> {
  const themeId = new URL(request.url).searchParams.get("themeId")?.trim();
  if (!themeId) throw new HttpError(400, "Le thème est obligatoire.");
  if (!(await themeById(env, themeId))) throw new HttpError(404, "Thème introuvable.");
  return json(request, { questions: groupQuestions(await questionRows(env, "theme", themeId)) });
}

async function saveQuestion(
  env: Env,
  questionId: string,
  input: QuestionInput,
  mode: "create" | "update",
): Promise<void> {
  if (!(await themeById(env, input.themeId))) throw new HttpError(400, "Le thème est invalide.");
  const storageKind = input.kind === "multiple_choice" || input.kind === "true_false"
    ? input.kind
    : "short_answer";

  const statements: D1PreparedStatement[] = mode === "create"
    ? [
        env.DB.prepare(
          `INSERT INTO questions (
            id,
            chapter_id,
            kind,
            response_kind,
            prompt,
            explanation,
            expected_answer,
            numeric_tolerance,
            answer_unit,
            difficulty,
            xp_reward,
            status
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
        ).bind(
          questionId,
          input.themeId,
          storageKind,
          input.kind,
          input.prompt,
          input.explanation,
          input.expectedAnswer,
          input.numericTolerance,
          input.answerUnit,
          input.difficulty,
          input.xpReward,
          input.status,
        ),
      ]
    : [
        env.DB.prepare(
          `UPDATE questions
           SET chapter_id = ?1,
               kind = ?2,
               response_kind = ?3,
               prompt = ?4,
               explanation = ?5,
               expected_answer = ?6,
               numeric_tolerance = ?7,
               answer_unit = ?8,
               difficulty = ?9,
               xp_reward = ?10,
               status = ?11,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?12`,
        ).bind(
          input.themeId,
          storageKind,
          input.kind,
          input.prompt,
          input.explanation,
          input.expectedAnswer,
          input.numericTolerance,
          input.answerUnit,
          input.difficulty,
          input.xpReward,
          input.status,
          questionId,
        ),
        env.DB.prepare("DELETE FROM answer_choices WHERE question_id = ?1").bind(questionId),
        env.DB.prepare("DELETE FROM question_items WHERE question_id = ?1").bind(questionId),
      ];

  input.choices.forEach((choice, index) => {
    statements.push(
      env.DB.prepare(
        `INSERT INTO answer_choices (id, question_id, label, is_correct, position)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      ).bind(
        crypto.randomUUID(),
        questionId,
        choice.label,
        choice.isCorrect ? 1 : 0,
        index + 1,
      ),
    );
  });

  input.items.forEach((item, index) => {
    statements.push(
      env.DB.prepare(
        `INSERT INTO question_items (
          id, question_id, item_prompt, item_answer, accepted_answers, position
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(
        crypto.randomUUID(),
        questionId,
        item.prompt || null,
        item.answer,
        JSON.stringify(item.acceptedAnswers),
        index + 1,
      ),
    );
  });

  await env.DB.batch(statements);
}

export async function createAdminQuestion(request: Request, env: Env): Promise<Response> {
  const input = questionInput(await readJsonObject(request, 65_536));
  const questionId = crypto.randomUUID();
  await saveQuestion(env, questionId, input, "create");
  const question = questionFromRows(await questionRows(env, "question", questionId));
  if (!question) throw new Error("Created question could not be reloaded");
  return json(request, { question }, { status: 201 });
}

export async function updateAdminQuestion(
  request: Request,
  env: Env,
  questionId: string,
): Promise<Response> {
  if ((await questionRows(env, "question", questionId)).length === 0) {
    throw new HttpError(404, "Question introuvable.");
  }
  const input = questionInput(await readJsonObject(request, 65_536));
  await saveQuestion(env, questionId, input, "update");
  const question = questionFromRows(await questionRows(env, "question", questionId));
  if (!question) throw new Error("Updated question could not be reloaded");
  return json(request, { question });
}
