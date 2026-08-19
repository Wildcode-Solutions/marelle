import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const testEmail = `eleve-${crypto.randomUUID()}@marelle.test`;
const testPassword = "Une-Marelle-2026!";

function request(pathname: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(
    new Request(`https://marelle.test${pathname}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    }),
  );
}

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("Set-Cookie");
  expect(setCookie).toContain("marelle_session=");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("Secure");
  return setCookie?.split(";", 1)[0] ?? "";
}

describe("Marelle Worker API", () => {
  it("reports that D1 is available", async () => {
    const response = await request("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      services: { database: "ok" },
    });
  });

  it("protects authenticated and administrative pages without a session", async () => {
    const dashboardResponse = await request("/api/dashboard");

    expect(dashboardResponse.status).toBe(401);
    await expect(dashboardResponse.json()).resolves.toEqual({
      error: "Authentification requise.",
    });

    const adminResponse = await request("/api/admin/overview");
    expect(adminResponse.status).toBe(401);
    await expect(adminResponse.json()).resolves.toEqual({
      error: "Authentification requise.",
    });
  });

  it("handles the complete account and session lifecycle in D1", async () => {
    const registerResponse = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        displayName: "Alex",
        email: testEmail,
        password: testPassword,
      }),
    });
    expect(registerResponse.status).toBe(201);
    const registerCookie = cookieFrom(registerResponse);
    const registerBody = await registerResponse.json<{
      user: { id: string; email: string; role: string; displayName: string };
    }>();
    expect(registerBody).toMatchObject({
      user: {
        email: testEmail,
        displayName: "Alex",
        role: "student",
      },
    });

    const storedUser = await env.DB.prepare(
      "SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?1",
    )
      .bind(registerBody.user.id)
      .first<{
        password_hash: string;
        password_salt: string;
        password_iterations: number;
      }>();
    expect(storedUser?.password_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(storedUser?.password_hash).not.toContain(testPassword);
    expect(storedUser?.password_salt).toMatch(/^[0-9a-f]{32}$/);
    expect(storedUser?.password_iterations).toBe(600_000);

    const meResponse = await request("/api/auth/me", {
      headers: { Cookie: registerCookie },
    });
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      user: { id: registerBody.user.id, email: testEmail, displayName: "Alex" },
    });

    const dashboardResponse = await request("/api/dashboard", {
      headers: { Cookie: registerCookie },
    });
    expect(dashboardResponse.status).toBe(200);
    await expect(dashboardResponse.json()).resolves.toMatchObject({
      user: {
        id: registerBody.user.id,
        role: "student",
        schoolLevel: { id: "6e", label: "6e" },
      },
      today: { goalXp: 20 },
    });

    const levelsResponse = await request("/api/school-levels", {
      headers: { Cookie: registerCookie },
    });
    expect(levelsResponse.status).toBe(200);
    const levelsBody = await levelsResponse.json<{ schoolLevels: Array<{ id: string }> }>();
    expect(levelsBody.schoolLevels.map((level) => level.id)).toContain("3e");

    const updateLevelResponse = await request("/api/auth/me", {
      method: "PATCH",
      headers: { Cookie: registerCookie },
      body: JSON.stringify({ schoolLevelId: "3e" }),
    });
    expect(updateLevelResponse.status).toBe(200);
    await expect(updateLevelResponse.json()).resolves.toMatchObject({
      user: { id: registerBody.user.id, schoolLevel: { id: "3e", label: "3e" } },
    });

    const updatedMeResponse = await request("/api/auth/me", {
      headers: { Cookie: registerCookie },
    });
    await expect(updatedMeResponse.json()).resolves.toMatchObject({
      user: { schoolLevel: { id: "3e", label: "3e" } },
    });

    const forbiddenAdminResponse = await request("/api/admin/overview", {
      headers: { Cookie: registerCookie },
    });
    expect(forbiddenAdminResponse.status).toBe(403);
    await expect(forbiddenAdminResponse.json()).resolves.toEqual({
      error: "Accès réservé aux administrateurs.",
    });

    const forbiddenUsersResponse = await request("/api/admin/users", {
      headers: { Cookie: registerCookie },
    });
    expect(forbiddenUsersResponse.status).toBe(403);

    await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?1")
      .bind(registerBody.user.id)
      .run();
    try {
      const adminResponse = await request("/api/admin/overview", {
        headers: { Cookie: registerCookie },
      });
      expect(adminResponse.status).toBe(200);
      await expect(adminResponse.json()).resolves.toEqual({
        users: { total: 2, students: 1, admins: 1 },
        activeSessions: 1,
        activeSubjects: 6,
      });

      const usersResponse = await request("/api/admin/users?role=student", {
        headers: { Cookie: registerCookie },
      });
      expect(usersResponse.status).toBe(200);
      await expect(usersResponse.json()).resolves.toMatchObject({
        users: [{ id: "demo-user", displayName: "Camille", role: "student" }],
        pagination: { limit: 50, offset: 0, hasMore: false },
      });

      const selfDemotionResponse = await request(
        `/api/admin/users/${registerBody.user.id}`,
        {
          method: "PATCH",
          headers: { Cookie: registerCookie },
          body: JSON.stringify({ role: "student" }),
        },
      );
      expect(selfDemotionResponse.status).toBe(400);

      try {
        const promoteResponse = await request("/api/admin/users/demo-user", {
          method: "PATCH",
          headers: { Cookie: registerCookie },
          body: JSON.stringify({ displayName: "Camille Gestion", role: "admin" }),
        });
        expect(promoteResponse.status).toBe(200);
        await expect(promoteResponse.json()).resolves.toMatchObject({
          user: { id: "demo-user", displayName: "Camille Gestion", role: "admin" },
        });

        const adminsResponse = await request("/api/admin/users?role=admin", {
          headers: { Cookie: registerCookie },
        });
        const adminsBody = await adminsResponse.json<{ users: Array<{ id: string }> }>();
        expect(adminsResponse.status).toBe(200);
        expect(adminsBody.users.map((user) => user.id)).toEqual(
          expect.arrayContaining(["demo-user", registerBody.user.id]),
        );
      } finally {
        await env.DB.prepare(
          "UPDATE users SET display_name = 'Camille', role = 'student' WHERE id = 'demo-user'",
        ).run();
      }

      const catalogResponse = await request("/api/admin/catalog", {
        headers: { Cookie: registerCookie },
      });
      expect(catalogResponse.status).toBe(200);
      const catalogBody = await catalogResponse.json<{
        schoolLevels: Array<{ id: string; label: string }>;
        subjects: Array<{ id: string; name: string }>;
      }>();
      expect(catalogBody.schoolLevels).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "6e", label: "6e" })]),
      );
      expect(catalogBody.subjects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "mathematics", name: "Mathématiques" }),
        ]),
      );

      const themeResponse = await request("/api/admin/themes", {
        method: "POST",
        headers: { Cookie: registerCookie },
        body: JSON.stringify({
          title: "Calcul mental express",
          summary: "Un thème créé depuis le studio d’administration.",
          subjectId: "mathematics",
          schoolLevelId: "5e",
          position: 99,
          isActive: true,
        }),
      });
      expect(themeResponse.status).toBe(201);
      const themeBody = await themeResponse.json<{ theme: { id: string; title: string } }>();
      expect(themeBody.theme.title).toBe("Calcul mental express");

      const qcmResponse = await request("/api/admin/questions", {
        method: "POST",
        headers: { Cookie: registerCookie },
        body: JSON.stringify({
          themeId: themeBody.theme.id,
          kind: "multiple_choice",
          prompt: "Combien font 12 × 4 ?",
          explanation: "Douze groupes de quatre donnent quarante-huit.",
          expectedAnswer: null,
          difficulty: 2,
          xpReward: 10,
          status: "draft",
          choices: [
            { label: "36", isCorrect: false },
            { label: "48", isCorrect: true },
            { label: "52", isCorrect: false },
          ],
        }),
      });
      expect(qcmResponse.status).toBe(201);
      const qcmBody = await qcmResponse.json<{
        question: { id: string; choices: Array<{ label: string; isCorrect: boolean }> };
      }>();
      expect(qcmBody.question.choices).toHaveLength(3);
      expect(qcmBody.question.choices.find((choice) => choice.isCorrect)?.label).toBe("48");

      const freeAnswerResponse = await request("/api/admin/questions", {
        method: "POST",
        headers: { Cookie: registerCookie },
        body: JSON.stringify({
          themeId: themeBody.theme.id,
          kind: "short_answer",
          prompt: "Écris le résultat de 9 × 7.",
          explanation: "Neuf fois sept font soixante-trois.",
          expectedAnswer: "63",
          difficulty: 2,
          xpReward: 10,
          status: "published",
          choices: [],
        }),
      });
      expect(freeAnswerResponse.status).toBe(201);

      const updateQuestionResponse = await request(
        `/api/admin/questions/${qcmBody.question.id}`,
        {
          method: "PATCH",
          headers: { Cookie: registerCookie },
          body: JSON.stringify({
            themeId: themeBody.theme.id,
            kind: "multiple_choice",
            prompt: "Combien font 12 × 4 ?",
            explanation: "Douze fois quatre font quarante-huit.",
            expectedAnswer: null,
            difficulty: 2,
            xpReward: 15,
            status: "published",
            choices: [
              { label: "36", isCorrect: false },
              { label: "48", isCorrect: true },
            ],
          }),
        },
      );
      expect(updateQuestionResponse.status).toBe(200);
      await expect(updateQuestionResponse.json()).resolves.toMatchObject({
        question: { status: "published", xpReward: 15 },
      });

      const questionsResponse = await request(
        `/api/admin/questions?themeId=${themeBody.theme.id}`,
        { headers: { Cookie: registerCookie } },
      );
      const questionsBody = await questionsResponse.json<{ questions: unknown[] }>();
      expect(questionsResponse.status).toBe(200);
      expect(questionsBody.questions).toHaveLength(2);
    } finally {
      await env.DB.prepare("UPDATE users SET role = 'student' WHERE id = ?1")
        .bind(registerBody.user.id)
        .run();
    }

    const duplicateResponse = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        displayName: "Autre Alex",
        email: testEmail.toUpperCase(),
        password: testPassword,
      }),
    });
    expect(duplicateResponse.status).toBe(409);

    const logoutResponse = await request("/api/auth/logout", {
      method: "POST",
      headers: { Cookie: registerCookie },
    });
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("Set-Cookie")).toContain("Max-Age=0");

    const revokedResponse = await request("/api/auth/me", {
      headers: { Cookie: registerCookie },
    });
    expect(revokedResponse.status).toBe(401);
  });

  it("rejects unknown cross-origin requests", async () => {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: testPassword }),
      headers: { Origin: "https://malicious.example" },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Origin not allowed" });
  });

  it("returns a structured 404 response", async () => {
    const response = await request("/api/unknown");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
