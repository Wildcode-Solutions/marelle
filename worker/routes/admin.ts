import { currentAppDate } from "../lib/date";
import { json } from "../lib/http";

interface ConnectionMetricsRow {
  active_users_last_7_days: number;
  last_24_hours: number;
  last_7_days: number;
  last_connection_at: number | null;
  total: number;
}

interface RecentLoginRow {
  avatar_emoji: string;
  display_name: string;
  email: string;
  event_type: "registration" | "login";
  id: string;
  occurred_at: number;
  user_id: string;
}

function connectionMetricsFrom(
  result: D1Result<unknown> | undefined,
): ConnectionMetricsRow {
  const row = result?.results[0];
  if (
    typeof row !== "object" ||
    row === null ||
    !("total" in row) ||
    typeof row.total !== "number" ||
    !("last_24_hours" in row) ||
    typeof row.last_24_hours !== "number" ||
    !("last_7_days" in row) ||
    typeof row.last_7_days !== "number" ||
    !("active_users_last_7_days" in row) ||
    typeof row.active_users_last_7_days !== "number" ||
    !("last_connection_at" in row) ||
    (row.last_connection_at !== null && typeof row.last_connection_at !== "number")
  ) {
    throw new Error("D1 returned invalid connection metrics");
  }

  return {
    total: row.total,
    last_24_hours: row.last_24_hours,
    last_7_days: row.last_7_days,
    active_users_last_7_days: row.active_users_last_7_days,
    last_connection_at: row.last_connection_at,
  };
}

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
    env.DB.prepare("SELECT COUNT(*) AS count FROM chapters"),
    env.DB.prepare("SELECT COUNT(*) AS count FROM questions"),
    env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM answer_choices) +
        (SELECT COUNT(*) FROM questions WHERE expected_answer IS NOT NULL) AS count`,
    ),
    env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN occurred_at >= unixepoch() - 86400 THEN 1 ELSE 0 END), 0)
           AS last_24_hours,
         COALESCE(SUM(CASE WHEN occurred_at >= unixepoch() - 604800 THEN 1 ELSE 0 END), 0)
           AS last_7_days,
         COUNT(DISTINCT CASE WHEN occurred_at >= unixepoch() - 604800 THEN user_id END)
           AS active_users_last_7_days,
         MAX(occurred_at) AS last_connection_at
       FROM user_login_events`,
    ),
    env.DB.prepare(
      `SELECT COUNT(*) AS count
       FROM daily_challenges
       WHERE status = 'published' AND publication_date > ?1`,
    ).bind(currentAppDate()),
  ]);

  const connectionMetrics = connectionMetricsFrom(results[7]);

  const { results: recentLogins } = await env.DB.prepare(
    `SELECT
       e.id,
       e.user_id,
       e.event_type,
       e.occurred_at,
       u.display_name,
       u.email,
       u.avatar_emoji
     FROM user_login_events e
     JOIN users u ON u.id = e.user_id
     ORDER BY e.occurred_at DESC, e.id DESC
     LIMIT 12`,
  ).all<RecentLoginRow>();

  const totalUsers = countFrom(results[0], "users");
  const adminUsers = countFrom(results[1], "admins");

  return json(request, {
    users: {
      total: totalUsers,
      students: totalUsers - adminUsers,
      admins: adminUsers,
    },
    activeSessions: countFrom(results[2], "active sessions"),
    connections: {
      total: connectionMetrics.total,
      last24Hours: connectionMetrics.last_24_hours,
      last7Days: connectionMetrics.last_7_days,
      activeUsersLast7Days: connectionMetrics.active_users_last_7_days,
      lastAt: connectionMetrics.last_connection_at === null
        ? null
        : new Date(connectionMetrics.last_connection_at * 1_000).toISOString(),
      recent: recentLogins.map((login) => ({
        id: login.id,
        userId: login.user_id,
        displayName: login.display_name,
        email: login.email,
        avatarEmoji: login.avatar_emoji,
        kind: login.event_type,
        occurredAt: new Date(login.occurred_at * 1_000).toISOString(),
      })),
    },
    activeSubjects: countFrom(results[3], "active subjects"),
    scheduledDailyChallenges: countFrom(results[8], "scheduled daily challenges"),
    content: {
      themes: countFrom(results[4], "themes"),
      questions: countFrom(results[5], "questions"),
      answers: countFrom(results[6], "answers"),
    },
  });
}
