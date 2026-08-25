import type { AuthUser } from "../lib/auth";
import { HttpError, json, readJsonObject } from "../lib/http";

type UserRole = "student" | "admin";

interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  avatar_emoji: string;
  school_level_id: string;
  school_level_label: string;
  xp: number;
  created_at: string;
  last_login_at: number | null;
  login_count: number;
}

function toAdminUser(row: AdminUserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    avatarEmoji: row.avatar_emoji,
    schoolLevel: {
      id: row.school_level_id,
      label: row.school_level_label,
    },
    xp: row.xp,
    createdAt: row.created_at,
    loginCount: row.login_count,
    lastLoginAt: row.last_login_at === null
      ? null
      : new Date(row.last_login_at * 1_000).toISOString(),
  };
}

function integerParameter(value: string | null, fallback: number, minimum: number, maximum: number) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new HttpError(400, "Les paramètres de pagination sont invalides.");
  }
  return parsed;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validateEmail(email: string): void {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "L’adresse e-mail est invalide.");
  }
}

function validateDisplayName(displayName: string): void {
  if (displayName.length < 2 || displayName.length > 40) {
    throw new HttpError(400, "Le prénom doit contenir entre 2 et 40 caractères.");
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

async function findUser(env: Env, userId: string): Promise<AdminUserRow | null> {
  return env.DB.prepare(
    `SELECT
      u.id,
      u.email,
      u.display_name,
      u.role,
      u.avatar_emoji,
      u.school_level_id,
      l.label AS school_level_label,
      u.xp,
      u.created_at,
      COALESCE(login_activity.login_count, 0) AS login_count,
      login_activity.last_login_at
     FROM users u
     JOIN school_levels l ON l.id = u.school_level_id
     LEFT JOIN (
       SELECT user_id, COUNT(*) AS login_count, MAX(occurred_at) AS last_login_at
       FROM user_login_events
       GROUP BY user_id
     ) login_activity ON login_activity.user_id = u.id
     WHERE u.id = ?1`,
  )
    .bind(userId)
    .first<AdminUserRow>();
}

export async function adminUsers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const requestedRole = url.searchParams.get("role") ?? "all";
  if (requestedRole !== "all" && requestedRole !== "student" && requestedRole !== "admin") {
    throw new HttpError(400, "Le filtre de rôle est invalide.");
  }

  const role = requestedRole === "all" ? null : requestedRole;
  const limit = integerParameter(url.searchParams.get("limit"), 50, 1, 100);
  const offset = integerParameter(url.searchParams.get("offset"), 0, 0, 100_000);
  const result = await env.DB.prepare(
    `SELECT
      u.id,
      u.email,
      u.display_name,
      u.role,
      u.avatar_emoji,
      u.school_level_id,
      l.label AS school_level_label,
      u.xp,
      u.created_at,
      COALESCE(login_activity.login_count, 0) AS login_count,
      login_activity.last_login_at
     FROM users u
     JOIN school_levels l ON l.id = u.school_level_id
     LEFT JOIN (
       SELECT user_id, COUNT(*) AS login_count, MAX(occurred_at) AS last_login_at
       FROM user_login_events
       GROUP BY user_id
     ) login_activity ON login_activity.user_id = u.id
     WHERE (?1 IS NULL OR u.role = ?1)
     ORDER BY u.display_name COLLATE NOCASE, u.email COLLATE NOCASE
     LIMIT ?2 OFFSET ?3`,
  )
    .bind(role, limit + 1, offset)
    .all<AdminUserRow>();

  return json(request, {
    users: result.results.slice(0, limit).map(toAdminUser),
    pagination: {
      limit,
      offset,
      hasMore: result.results.length > limit,
    },
  });
}

export async function updateAdminUser(
  request: Request,
  env: Env,
  actor: AuthUser,
  userId: string,
): Promise<Response> {
  const current = await findUser(env, userId);
  if (!current) throw new HttpError(404, "Compte utilisateur introuvable.");

  const body = await readJsonObject(request);
  const hasEditableField = ["displayName", "email", "schoolLevelId", "role"].some(
    (field) => field in body,
  );
  if (!hasEditableField) {
    throw new HttpError(400, "Aucune modification n’a été fournie.");
  }

  const displayName = "displayName" in body
    ? typeof body.displayName === "string"
      ? body.displayName.trim().replace(/\s+/g, " ")
      : ""
    : current.display_name;
  const email = "email" in body
    ? typeof body.email === "string"
      ? normalizeEmail(body.email)
      : ""
    : current.email;
  const schoolLevelId = "schoolLevelId" in body
    ? typeof body.schoolLevelId === "string"
      ? body.schoolLevelId.trim()
      : ""
    : current.school_level_id;
  const role = "role" in body && (body.role === "student" || body.role === "admin")
    ? body.role
    : "role" in body
      ? null
      : current.role;

  validateDisplayName(displayName);
  validateEmail(email);
  if (!schoolLevelId) throw new HttpError(400, "Le niveau scolaire sélectionné est invalide.");
  if (!role) throw new HttpError(400, "Le rôle sélectionné est invalide.");

  if (actor.id === userId && actor.role === "admin" && role !== "admin") {
    throw new HttpError(400, "Tu ne peux pas retirer ton propre rôle administrateur.");
  }

  const schoolLevel = await env.DB.prepare(
    "SELECT id FROM school_levels WHERE id = ?1",
  )
    .bind(schoolLevelId)
    .first<{ id: string }>();
  if (!schoolLevel) throw new HttpError(400, "Le niveau scolaire sélectionné est invalide.");

  try {
    await env.DB.prepare(
      `UPDATE users
       SET email = ?1,
           display_name = ?2,
           school_level_id = ?3,
           role = ?4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?5`,
    )
      .bind(email, displayName, schoolLevelId, role, userId)
      .run();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Un compte existe déjà avec cette adresse e-mail.");
    }
    throw error;
  }

  const updated = await findUser(env, userId);
  if (!updated) throw new Error("Updated user could not be reloaded");
  return json(request, { user: toAdminUser(updated) });
}
