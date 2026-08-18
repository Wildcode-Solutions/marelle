import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Marelle API", () => {
  it("reports that D1 is available", async () => {
    const response = await exports.default.fetch("https://marelle.test/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      services: { database: "ok" },
    });
  });

  it("returns the demo dashboard from D1", async () => {
    const response = await exports.default.fetch("https://marelle.test/api/dashboard");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      user: {
        id: "demo-user",
        role: "student",
        displayName: "Camille",
        schoolLevel: { id: "6e", label: "6e" },
      },
      today: {
        goalXp: 20,
      },
    });
  });

  it("allows a user to have the admin role", async () => {
    const updateRole = env.DB.prepare("UPDATE users SET role = ?1 WHERE id = ?2");
    await updateRole.bind("admin", "demo-user").run();

    try {
      const response = await exports.default.fetch("https://marelle.test/api/dashboard");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        user: { id: "demo-user", role: "admin" },
      });
    } finally {
      await updateRole.bind("student", "demo-user").run();
    }
  });

  it("returns a structured 404 response", async () => {
    const response = await exports.default.fetch("https://marelle.test/api/unknown");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
