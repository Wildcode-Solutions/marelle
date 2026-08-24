import { requireAdminUser, requireSessionUser } from "./lib/auth";
import { applyCors, assertAllowedOrigin, HttpError, json, preflight } from "./lib/http";
import {
  adminCatalog,
  adminQuestions,
  adminThemes,
  createAdminQuestion,
  createAdminTheme,
  updateAdminQuestion,
  updateAdminTheme,
} from "./routes/admin-content";
import { adminUsers, updateAdminUser } from "./routes/admin-users";
import {
  adminDailyChallenges,
  adminDailyQuestionLibrary,
  createAdminDailyChallenge,
  deleteAdminDailyChallenge,
  updateAdminDailyChallenge,
} from "./routes/admin-daily-challenges";
import {
  adminSubjects,
  createAdminSubject,
  updateAdminSubject,
} from "./routes/admin-subjects";
import { adminOverview } from "./routes/admin";
import { login, logout, me, register, schoolLevels, updateProfile } from "./routes/auth";
import { dashboard } from "./routes/dashboard";
import {
  answerDailyChallenge,
  dailyChallenge,
  finishDailyChallenge,
  startDailyChallenge,
} from "./routes/daily-challenge";
import { subjects } from "./routes/subjects";

function methodNotAllowed(request: Request, methods: string[]): Response {
  return json(request, { error: "Method not allowed" }, {
    status: 405,
    headers: { Allow: methods.join(", ") },
  });
}

function pathIdentifier(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const encodedId = pathname.slice(prefix.length);
  if (!encodedId || encodedId.includes("/")) return null;

  try {
    return decodeURIComponent(encodedId);
  } catch {
    throw new HttpError(400, "L’identifiant de la ressource est invalide.");
  }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return preflight(request, env.ALLOWED_ORIGINS);
  assertAllowedOrigin(request, env.ALLOWED_ORIGINS);

  const { pathname } = new URL(request.url);
  const adminUserId = pathIdentifier(pathname, "/api/admin/users/");
  if (adminUserId !== null) {
    if (request.method !== "PATCH") return methodNotAllowed(request, ["PATCH"]);
    const actor = await requireAdminUser(request, env);
    return updateAdminUser(request, env, actor, adminUserId);
  }

  const adminDailyChallengeId = pathIdentifier(pathname, "/api/admin/daily-challenges/");
  if (adminDailyChallengeId !== null) {
    if (request.method !== "PATCH" && request.method !== "DELETE") {
      return methodNotAllowed(request, ["PATCH", "DELETE"]);
    }
    await requireAdminUser(request, env);
    return request.method === "PATCH"
      ? updateAdminDailyChallenge(request, env, adminDailyChallengeId)
      : deleteAdminDailyChallenge(request, env, adminDailyChallengeId);
  }

  const adminThemeId = pathIdentifier(pathname, "/api/admin/themes/");
  if (adminThemeId !== null) {
    if (request.method !== "PATCH") return methodNotAllowed(request, ["PATCH"]);
    await requireAdminUser(request, env);
    return updateAdminTheme(request, env, adminThemeId);
  }

  const adminQuestionId = pathIdentifier(pathname, "/api/admin/questions/");
  if (adminQuestionId !== null) {
    if (request.method !== "PATCH") return methodNotAllowed(request, ["PATCH"]);
    await requireAdminUser(request, env);
    return updateAdminQuestion(request, env, adminQuestionId);
  }

  const adminSubjectId = pathIdentifier(pathname, "/api/admin/subjects/");
  if (adminSubjectId !== null) {
    if (request.method !== "PATCH") return methodNotAllowed(request, ["PATCH"]);
    await requireAdminUser(request, env);
    return updateAdminSubject(request, env, adminSubjectId);
  }

  switch (pathname) {
    case "/api/health":
      if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);
      await env.DB.prepare("SELECT 1").first();
      return json(request, { status: "ok", services: { database: "ok" } });

    case "/api/auth/register":
      return request.method === "POST"
        ? register(request, env)
        : methodNotAllowed(request, ["POST"]);

    case "/api/auth/login":
      return request.method === "POST"
        ? login(request, env)
        : methodNotAllowed(request, ["POST"]);

    case "/api/auth/logout":
      return request.method === "POST"
        ? logout(request, env)
        : methodNotAllowed(request, ["POST"]);

    case "/api/auth/me": {
      if (request.method === "GET") return me(request, env);
      if (request.method === "PATCH") {
        const user = await requireSessionUser(request, env);
        return updateProfile(request, env, user);
      }
      return methodNotAllowed(request, ["GET", "PATCH"]);
    }

    case "/api/school-levels":
      if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);
      await requireSessionUser(request, env);
      return schoolLevels(request, env);

    case "/api/dashboard": {
      if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);
      const user = await requireSessionUser(request, env);
      return dashboard(request, env, user.id);
    }

    case "/api/daily-challenge": {
      if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);
      const user = await requireSessionUser(request, env);
      return dailyChallenge(request, env, user.id);
    }

    case "/api/daily-challenge/start": {
      if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);
      const user = await requireSessionUser(request, env);
      return startDailyChallenge(request, env, user.id);
    }

    case "/api/daily-challenge/answer": {
      if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);
      const user = await requireSessionUser(request, env);
      return answerDailyChallenge(request, env, user.id);
    }

    case "/api/daily-challenge/finish": {
      if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);
      const user = await requireSessionUser(request, env);
      return finishDailyChallenge(request, env, user.id);
    }

    case "/api/admin/overview":
      if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);
      await requireAdminUser(request, env);
      return adminOverview(request, env);

    case "/api/admin/users":
      if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);
      await requireAdminUser(request, env);
      return adminUsers(request, env);

    case "/api/admin/daily-challenges":
      if (request.method !== "GET" && request.method !== "POST") {
        return methodNotAllowed(request, ["GET", "POST"]);
      }
      await requireAdminUser(request, env);
      return request.method === "GET"
        ? adminDailyChallenges(request, env)
        : createAdminDailyChallenge(request, env);

    case "/api/admin/daily-question-library":
      if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);
      await requireAdminUser(request, env);
      return adminDailyQuestionLibrary(request, env);

    case "/api/admin/catalog":
      if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);
      await requireAdminUser(request, env);
      return adminCatalog(request, env);

    case "/api/admin/subjects":
      if (request.method !== "GET" && request.method !== "POST") {
        return methodNotAllowed(request, ["GET", "POST"]);
      }
      await requireAdminUser(request, env);
      return request.method === "GET"
        ? adminSubjects(request, env)
        : createAdminSubject(request, env);

    case "/api/admin/themes":
      if (request.method !== "GET" && request.method !== "POST") {
        return methodNotAllowed(request, ["GET", "POST"]);
      }
      await requireAdminUser(request, env);
      return request.method === "GET"
        ? adminThemes(request, env)
        : createAdminTheme(request, env);

    case "/api/admin/questions":
      if (request.method !== "GET" && request.method !== "POST") {
        return methodNotAllowed(request, ["GET", "POST"]);
      }
      await requireAdminUser(request, env);
      return request.method === "GET"
        ? adminQuestions(request, env)
        : createAdminQuestion(request, env);

    case "/api/subjects":
      return request.method === "GET"
        ? subjects(request, env)
        : methodNotAllowed(request, ["GET"]);

    default:
      return json(request, { error: "Not found" }, { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return applyCors(await handleRequest(request, env), request, env.ALLOWED_ORIGINS);
    } catch (error) {
      if (error instanceof HttpError) {
        return applyCors(
          json(request, { error: error.message }, { status: error.status }),
          request,
          env.ALLOWED_ORIGINS,
        );
      }

      console.error(
        JSON.stringify({
          message: "Unhandled request error",
          method: request.method,
          path: new URL(request.url).pathname,
          error: error instanceof Error ? error.message : String(error),
        }),
      );

      return applyCors(
        json(request, { error: "Internal server error" }, { status: 500 }),
        request,
        env.ALLOWED_ORIGINS,
      );
    }
  },
} satisfies ExportedHandler<Env>;
