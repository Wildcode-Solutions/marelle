import {
  createSession,
  expiredSessionCookie,
  requireSessionUser,
  revokeSession,
  sessionInsertStatement,
  type AuthUser,
} from "../lib/auth";
import { hashPassword, verifyPassword, type PasswordDigest } from "../lib/crypto";
import { HttpError, json, readJsonObject } from "../lib/http";

const FAKE_PASSWORD_DIGEST: PasswordDigest = {
  hash: "0000000000000000000000000000000000000000000000000000000000000000",
  iterations: 100_000,
  salt: "000102030405060708090a0b0c0d0e0f",
};

interface LoginUserRow {
  id: string;
  email: string;
  role: "student" | "admin";
  display_name: string;
  avatar_emoji: string;
  profile_color: string;
  school_level_id: string;
  school_level_label: string;
  password_hash: string | null;
  password_salt: string | null;
  password_iterations: number | null;
}

interface SchoolLevelRow {
  id: string;
  label: string;
}

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string") {
    throw new HttpError(400, "Tous les champs sont obligatoires.");
  }
  return value;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validateEmail(email: string): void {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "L’adresse e-mail est invalide.");
  }
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new HttpError(400, "Le mot de passe doit contenir au moins 8 caractères.");
  }
  if (password.length > 128) {
    throw new HttpError(400, "Le mot de passe ne peut pas dépasser 128 caractères.");
  }
}

function validateDisplayName(displayName: string): void {
  if (displayName.length < 2 || displayName.length > 40) {
    throw new HttpError(400, "Le prénom doit contenir entre 2 et 40 caractères.");
  }
}

const PROFILE_COLOR_OPTIONS = new Set([
  "#6C5CE7",
  "#315F9E",
  "#D95652",
  "#F59E0B",
  "#10B981",
  "#F06292",
]);

function normalizedDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "Le prénom est invalide.");
  }
  const displayName = value.trim().replace(/\s+/g, " ");
  validateDisplayName(displayName);
  return displayName;
}

function validatedAvatar(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpError(400, "L’avatar sélectionné est invalide.");
  }

  const avatar = value.trim();
  const graphemes = Array.from(
    new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(avatar),
    ({ segment }) => segment,
  );
  const isEmoji = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u;

  if (graphemes.length !== 1 || !isEmoji.test(avatar)) {
    throw new HttpError(400, "L’avatar sélectionné est invalide.");
  }
  return avatar;
}

function validatedProfileColor(value: unknown): string {
  if (typeof value !== "string" || !PROFILE_COLOR_OPTIONS.has(value)) {
    throw new HttpError(400, "La couleur sélectionnée est invalide.");
  }
  return value;
}

function toAuthUser(row: LoginUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    profileColor: row.profile_color,
    schoolLevel: {
      id: row.school_level_id,
      label: row.school_level_label,
    },
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

export async function register(request: Request, env: Env): Promise<Response> {
  const body = await readJsonObject(request);
  const email = normalizeEmail(requiredString(body, "email"));
  const password = requiredString(body, "password");
  const displayName = requiredString(body, "displayName").trim().replace(/\s+/g, " ");

  validateEmail(email);
  validatePassword(password);
  validateDisplayName(displayName);

  const schoolLevel = await env.DB.prepare(
    "SELECT id, label FROM school_levels ORDER BY position ASC LIMIT 1",
  ).first<SchoolLevelRow>();
  if (!schoolLevel) {
    throw new HttpError(500, "Aucun niveau scolaire n’est disponible.");
  }

  const existingUser = await env.DB.prepare(
    "SELECT id FROM users WHERE email = ?1 COLLATE NOCASE",
  )
    .bind(email)
    .first<{ id: string }>();
  if (existingUser) {
    throw new HttpError(409, "Un compte existe déjà avec cette adresse e-mail.");
  }

  const userId = crypto.randomUUID();
  const passwordDigest = await hashPassword(password);
  const session = await createSession(request, userId);

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (
          id,
          email,
          display_name,
          school_level_id,
          password_hash,
          password_salt,
          password_iterations
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      ).bind(
        userId,
        email,
        displayName,
        schoolLevel.id,
        passwordDigest.hash,
        passwordDigest.salt,
        passwordDigest.iterations,
      ),
      sessionInsertStatement(env, session),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Un compte existe déjà avec cette adresse e-mail.");
    }
    throw error;
  }

  const user: AuthUser = {
    id: userId,
    email,
    role: "student",
    displayName,
    avatarEmoji: "🧑‍🎓",
    profileColor: "#6C5CE7",
    schoolLevel,
  };

  return json(request, { user }, {
    status: 201,
    headers: { "Set-Cookie": session.cookie },
  });
}

export async function login(request: Request, env: Env): Promise<Response> {
  const body = await readJsonObject(request);
  const email = normalizeEmail(requiredString(body, "email"));
  const password = requiredString(body, "password");

  validateEmail(email);
  validatePassword(password);

  const row = await env.DB.prepare(
    `SELECT
      u.id,
      u.email,
      u.role,
      u.display_name,
      u.avatar_emoji,
      u.profile_color,
      u.school_level_id,
      l.label AS school_level_label,
      u.password_hash,
      u.password_salt,
      u.password_iterations
     FROM users u
     JOIN school_levels l ON l.id = u.school_level_id
     WHERE u.email = ?1 COLLATE NOCASE`,
  )
    .bind(email)
    .first<LoginUserRow>();

  const digest: PasswordDigest =
    row?.password_hash && row.password_salt && row.password_iterations
      ? {
          hash: row.password_hash,
          salt: row.password_salt,
          iterations: row.password_iterations,
        }
      : FAKE_PASSWORD_DIGEST;
  const passwordIsValid = await verifyPassword(password, digest);

  if (!row || !row.password_hash || !passwordIsValid) {
    throw new HttpError(401, "Adresse e-mail ou mot de passe incorrect.");
  }

  const session = await createSession(request, row.id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at <= unixepoch()"),
    sessionInsertStatement(env, session),
  ]);

  return json(request, { user: toAuthUser(row) }, {
    headers: { "Set-Cookie": session.cookie },
  });
}

export async function me(request: Request, env: Env): Promise<Response> {
  const user = await requireSessionUser(request, env);
  return json(request, { user });
}

export async function schoolLevels(request: Request, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, label FROM school_levels ORDER BY position ASC",
  ).all<SchoolLevelRow>();
  return json(request, { schoolLevels: results });
}

export async function updateProfile(
  request: Request,
  env: Env,
  user: AuthUser,
): Promise<Response> {
  const body = await readJsonObject(request);
  const editableFields = ["displayName", "avatarEmoji", "profileColor", "schoolLevelId"];
  if (!editableFields.some((field) => field in body)) {
    throw new HttpError(400, "Aucune modification n’a été fournie.");
  }

  const displayName = "displayName" in body
    ? normalizedDisplayName(body.displayName)
    : user.displayName;
  const avatarEmoji = "avatarEmoji" in body
    ? validatedAvatar(body.avatarEmoji)
    : user.avatarEmoji;
  const profileColor = "profileColor" in body
    ? validatedProfileColor(body.profileColor)
    : user.profileColor;
  const schoolLevelId = "schoolLevelId" in body
    ? typeof body.schoolLevelId === "string"
      ? body.schoolLevelId.trim()
      : ""
    : user.schoolLevel.id;

  const schoolLevel = await env.DB.prepare(
    "SELECT id, label FROM school_levels WHERE id = ?1",
  )
    .bind(schoolLevelId)
    .first<SchoolLevelRow>();
  if (!schoolLevel) {
    throw new HttpError(400, "Le niveau scolaire sélectionné est invalide.");
  }

  await env.DB.prepare(
    `UPDATE users
     SET display_name = ?1,
         avatar_emoji = ?2,
         profile_color = ?3,
         school_level_id = ?4,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?5`,
  )
    .bind(displayName, avatarEmoji, profileColor, schoolLevel.id, user.id)
    .run();

  return json(request, {
    user: { ...user, displayName, avatarEmoji, profileColor, schoolLevel },
  });
}

interface PasswordRow {
  password_hash: string | null;
  password_iterations: number | null;
  password_salt: string | null;
}

async function verifyCurrentPassword(
  env: Env,
  userId: string,
  password: string,
): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT password_hash, password_salt, password_iterations
     FROM users
     WHERE id = ?1`,
  )
    .bind(userId)
    .first<PasswordRow>();
  const digest = row?.password_hash && row.password_salt && row.password_iterations
    ? {
        hash: row.password_hash,
        salt: row.password_salt,
        iterations: row.password_iterations,
      }
    : FAKE_PASSWORD_DIGEST;

  if (!row || !(await verifyPassword(password, digest))) {
    throw new HttpError(401, "Le mot de passe actuel est incorrect.");
  }
}

export async function updateEmail(
  request: Request,
  env: Env,
  user: AuthUser,
): Promise<Response> {
  const body = await readJsonObject(request);
  const email = normalizeEmail(requiredString(body, "email"));
  const currentPassword = requiredString(body, "currentPassword");
  validateEmail(email);
  validatePassword(currentPassword);
  await verifyCurrentPassword(env, user.id, currentPassword);

  try {
    await env.DB.prepare(
      "UPDATE users SET email = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
    )
      .bind(email, user.id)
      .run();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new HttpError(409, "Un compte existe déjà avec cette adresse e-mail.");
    }
    throw error;
  }

  return json(request, { user: { ...user, email } });
}

export async function updatePassword(
  request: Request,
  env: Env,
  user: AuthUser,
): Promise<Response> {
  const body = await readJsonObject(request);
  const currentPassword = requiredString(body, "currentPassword");
  const newPassword = requiredString(body, "newPassword");
  validatePassword(currentPassword);
  validatePassword(newPassword);
  if (currentPassword === newPassword) {
    throw new HttpError(400, "Choisis un nouveau mot de passe différent de l’ancien.");
  }
  await verifyCurrentPassword(env, user.id, currentPassword);

  const digest = await hashPassword(newPassword);
  const session = await createSession(request, user.id);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE users
       SET password_hash = ?1,
           password_salt = ?2,
           password_iterations = ?3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?4`,
    ).bind(digest.hash, digest.salt, digest.iterations, user.id),
    env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?1").bind(user.id),
    sessionInsertStatement(env, session),
  ]);

  return json(request, { success: true }, {
    headers: { "Set-Cookie": session.cookie },
  });
}

export async function deleteAccount(
  request: Request,
  env: Env,
  user: AuthUser,
): Promise<Response> {
  const body = await readJsonObject(request);
  const currentPassword = requiredString(body, "currentPassword");
  validatePassword(currentPassword);
  await verifyCurrentPassword(env, user.id, currentPassword);
  await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(user.id).run();

  return json(request, { success: true }, {
    headers: { "Set-Cookie": expiredSessionCookie(request) },
  });
}

export async function logout(request: Request, env: Env): Promise<Response> {
  await revokeSession(request, env);
  return json(request, { success: true }, {
    headers: { "Set-Cookie": expiredSessionCookie(request) },
  });
}
