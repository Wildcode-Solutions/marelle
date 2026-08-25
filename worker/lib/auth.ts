import { createSessionToken, hashSessionToken } from "./crypto";
import { HttpError } from "./http";

const SESSION_COOKIE = "marelle_session";
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
const CAPACITOR_ORIGINS = new Set(["capacitor://localhost", "ionic://localhost"]);

export interface AuthUser {
  id: string;
  email: string;
  role: "student" | "admin";
  displayName: string;
  avatarEmoji: string;
  profileColor: string;
  schoolLevel: {
    id: string;
    label: string;
  };
}

interface SessionUserRow {
  id: string;
  email: string;
  role: "student" | "admin";
  display_name: string;
  avatar_emoji: string;
  profile_color: string;
  school_level_id: string;
  school_level_label: string;
}

export interface PendingSession {
  cookie: string;
  expiresAt: number;
  id: string;
  tokenHash: string;
  userId: string;
}

function parseCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) continue;

    const cookieName = cookie.slice(0, separatorIndex).trim();
    if (cookieName === name) return cookie.slice(separatorIndex + 1).trim();
  }

  return null;
}

function toAuthUser(row: SessionUserRow): AuthUser {
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

function cookieAttributes(request: Request): string[] {
  const origin = request.headers.get("Origin");
  const requestOrigin = new URL(request.url).origin;
  const protocol = new URL(requestOrigin).protocol;
  const crossSiteHttpsRequest = origin !== null && origin !== requestOrigin && protocol === "https:";
  const crossSiteMobileRequest = origin ? CAPACITOR_ORIGINS.has(origin) : false;
  const attributes = [
    "Path=/",
    "HttpOnly",
    `SameSite=${crossSiteMobileRequest || crossSiteHttpsRequest ? "None" : "Lax"}`,
  ];

  if (protocol === "https:") attributes.push("Secure");
  return attributes;
}

export function sessionCookie(request: Request, token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    ...cookieAttributes(request),
    `Max-Age=${SESSION_DURATION_SECONDS}`,
  ].join("; ");
}

export function expiredSessionCookie(request: Request): string {
  return [
    `${SESSION_COOKIE}=`,
    ...cookieAttributes(request),
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export async function createSession(request: Request, userId: string): Promise<PendingSession> {
  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);

  return {
    cookie: sessionCookie(request, token),
    expiresAt: Math.floor(Date.now() / 1_000) + SESSION_DURATION_SECONDS,
    id: crypto.randomUUID(),
    tokenHash,
    userId,
  };
}

export function sessionInsertStatement(
  env: Env,
  session: PendingSession,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
     VALUES (?1, ?2, ?3, ?4)`,
  ).bind(session.id, session.userId, session.tokenHash, session.expiresAt);
}

export function loginEventInsertStatement(
  env: Env,
  session: PendingSession,
  eventType: "registration" | "login",
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO user_login_events (id, user_id, event_type)
     VALUES (?1, ?2, ?3)`,
  ).bind(session.id, session.userId, eventType);
}

export function getSessionToken(request: Request): string | null {
  const token = parseCookie(request, SESSION_COOKIE);
  return token && /^[0-9a-f]{64}$/i.test(token) ? token : null;
}

export async function getSessionUser(request: Request, env: Env): Promise<AuthUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  const tokenHash = await hashSessionToken(token);
  const row = await env.DB.prepare(
    `SELECT
      u.id,
      u.email,
      u.role,
      u.display_name,
      u.avatar_emoji,
      u.profile_color,
      u.school_level_id,
      l.label AS school_level_label
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     JOIN school_levels l ON l.id = u.school_level_id
     WHERE s.token_hash = ?1 AND s.expires_at > unixepoch()`,
  )
    .bind(tokenHash)
    .first<SessionUserRow>();

  return row ? toAuthUser(row) : null;
}

export async function requireSessionUser(request: Request, env: Env): Promise<AuthUser> {
  const user = await getSessionUser(request, env);
  if (!user) throw new HttpError(401, "Authentification requise.");
  return user;
}

export async function requireAdminUser(request: Request, env: Env): Promise<AuthUser> {
  const user = await requireSessionUser(request, env);
  if (user.role !== "admin") {
    throw new HttpError(403, "Accès réservé aux administrateurs.");
  }
  return user;
}

export async function revokeSession(request: Request, env: Env): Promise<void> {
  const token = getSessionToken(request);
  if (!token) return;

  const tokenHash = await hashSessionToken(token);
  await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?1").bind(tokenHash).run();
}
