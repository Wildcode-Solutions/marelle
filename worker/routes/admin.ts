import { json } from "../lib/http";

function countFrom(result: D1Result<unknown> | undefined, label: string): number {
  const row = result?.results[0];
  if (
    typeof row !== "object" ||
    row === null ||
    !("count" in row) ||
    typeof row.count !== "number"
  ) {
    throw new Error(`D1 returned an invalid ${label} count`);
  }

  return row.count;
}

export async function adminOverview(request: Request, env: Env): Promise<Response> {
  const results = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS count FROM users"),
    env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'"),
    env.DB.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE expires_at > unixepoch()"),
    env.DB.prepare("SELECT COUNT(*) AS count FROM subjects WHERE is_active = 1"),
    env.DB.prepare("SELECT COUNT(*) AS count FROM questions"),
    env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM answer_choices) +
        (SELECT COUNT(*) FROM questions WHERE expected_answer IS NOT NULL) AS count`,
    ),
  ]);

  const totalUsers = countFrom(results[0], "users");
  const adminUsers = countFrom(results[1], "admins");

  return json(request, {
    users: {
      total: totalUsers,
      students: totalUsers - adminUsers,
      admins: adminUsers,
    },
    activeSessions: countFrom(results[2], "active sessions"),
    activeSubjects: countFrom(results[3], "active subjects"),
    content: {
      questions: countFrom(results[4], "questions"),
      answers: countFrom(results[5], "answers"),
    },
  });
}
