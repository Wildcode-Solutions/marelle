import { HttpError, json, readJsonObject } from "../lib/http";

interface SubjectRow {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  icon: string;
  color: string;
  is_active: number;
  theme_count: number;
}

interface SubjectInput {
  name: string;
  shortName: string;
  icon: string;
  color: string;
  isActive: boolean;
}

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string") {
    throw new HttpError(400, `Le champ ${field} est obligatoire.`);
  }
  return value.trim();
}

function subjectInput(body: Record<string, unknown>): SubjectInput {
  const name = requiredString(body, "name");
  const shortName = requiredString(body, "shortName");
  const icon = requiredString(body, "icon");
  const color = requiredString(body, "color").toUpperCase();

  if (name.length < 2 || name.length > 80) {
    throw new HttpError(400, "Le nom de la matière doit contenir entre 2 et 80 caractères.");
  }
  if (!shortName || shortName.length > 30) {
    throw new HttpError(400, "Le nom court doit contenir entre 1 et 30 caractères.");
  }
  if (!icon || icon.length > 32) {
    throw new HttpError(400, "L’icône doit contenir entre 1 et 32 caractères.");
  }
  if (!/^#[0-9A-F]{6}$/.test(color)) {
    throw new HttpError(400, "La couleur doit être au format hexadécimal, par exemple #6C5CE7.");
  }
  if (typeof body.isActive !== "boolean") {
    throw new HttpError(400, "Le statut de la matière est invalide.");
  }

  return { name, shortName, icon, color, isActive: body.isActive };
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "matiere";
}

async function uniqueSubjectSlug(
  env: Env,
  name: string,
  currentSubjectId: string | null = null,
): Promise<string> {
  const base = slugify(name);
  const existing = await env.DB.prepare(
    "SELECT id FROM subjects WHERE slug = ?1 AND (?2 IS NULL OR id <> ?2)",
  )
    .bind(base, currentSubjectId)
    .first<{ id: string }>();
  return existing ? `${base}-${crypto.randomUUID().slice(0, 8)}` : base;
}

function toSubject(row: SubjectRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    icon: row.icon,
    color: row.color,
    isActive: row.is_active === 1,
    themeCount: row.theme_count,
  };
}

async function subjectById(env: Env, subjectId: string): Promise<SubjectRow | null> {
  return env.DB.prepare(
    `SELECT
      s.id,
      s.slug,
      s.name,
      s.short_name,
      s.icon,
      s.color,
      s.is_active,
      COUNT(c.id) AS theme_count
     FROM subjects s
     LEFT JOIN chapters c ON c.subject_id = s.id
     WHERE s.id = ?1
     GROUP BY s.id`,
  )
    .bind(subjectId)
    .first<SubjectRow>();
}

export async function adminSubjects(request: Request, env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT
      s.id,
      s.slug,
      s.name,
      s.short_name,
      s.icon,
      s.color,
      s.is_active,
      COUNT(c.id) AS theme_count
     FROM subjects s
     LEFT JOIN chapters c ON c.subject_id = s.id
     GROUP BY s.id
     ORDER BY s.name COLLATE NOCASE`,
  ).all<SubjectRow>();

  return json(request, { subjects: result.results.map(toSubject) });
}

export async function createAdminSubject(request: Request, env: Env): Promise<Response> {
  const input = subjectInput(await readJsonObject(request));
  const subjectId = crypto.randomUUID();
  const slug = await uniqueSubjectSlug(env, input.name);

  await env.DB.prepare(
    `INSERT INTO subjects (id, slug, name, short_name, icon, color, is_active)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
  )
    .bind(
      subjectId,
      slug,
      input.name,
      input.shortName,
      input.icon,
      input.color,
      input.isActive ? 1 : 0,
    )
    .run();

  const created = await subjectById(env, subjectId);
  if (!created) throw new Error("Created subject could not be reloaded");
  return json(request, { subject: toSubject(created) }, { status: 201 });
}

export async function updateAdminSubject(
  request: Request,
  env: Env,
  subjectId: string,
): Promise<Response> {
  const current = await subjectById(env, subjectId);
  if (!current) {
    throw new HttpError(404, "Matière introuvable.");
  }

  const input = subjectInput(await readJsonObject(request));
  const slug = input.name === current.name
    ? current.slug
    : await uniqueSubjectSlug(env, input.name, subjectId);

  await env.DB.prepare(
    `UPDATE subjects
     SET slug = ?1,
         name = ?2,
         short_name = ?3,
         icon = ?4,
         color = ?5,
         is_active = ?6
     WHERE id = ?7`,
  )
    .bind(
      slug,
      input.name,
      input.shortName,
      input.icon,
      input.color,
      input.isActive ? 1 : 0,
      subjectId,
    )
    .run();

  const updated = await subjectById(env, subjectId);
  if (!updated) throw new Error("Updated subject could not be reloaded");
  return json(request, { subject: toSubject(updated) });
}
