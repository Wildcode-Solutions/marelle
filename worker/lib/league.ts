import { currentAppDate, APP_TIME_ZONE } from "./date";

// ============================================================
// Configuration des ligues (source unique de vérité)
// ============================================================

export type LeagueKey =
  | "iron"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "emerald"
  | "ruby"
  | "diamond";

export type LeagueXpReason =
  | "DAILY_CHALLENGE_COMPLETION"
  | "CORRECT_ANSWER"
  | "PERFECT_DAILY_CHALLENGE"
  | "DAILY_FIRST_ACTIVITY"
  | "TRAINING_CORRECT_ANSWER"
  | "CORRECTED_MISTAKE";

export interface LeagueConfig {
  key: LeagueKey;
  name: string;
  rankOrder: number;
  icon: string;
  color: string;
}

export const LEAGUES: LeagueConfig[] = [
  { key: "iron",     name: "Fer",      rankOrder: 1, icon: "⚙️",  color: "#78909C" },
  { key: "bronze",   name: "Bronze",   rankOrder: 2, icon: "🥉",  color: "#A0522D" },
  { key: "silver",   name: "Argent",   rankOrder: 3, icon: "🥈",  color: "#90A4AE" },
  { key: "gold",     name: "Or",       rankOrder: 4, icon: "🥇",  color: "#F9A825" },
  { key: "platinum", name: "Platine",  rankOrder: 5, icon: "💠",  color: "#B0BEC5" },
  { key: "emerald",  name: "Émeraude", rankOrder: 6, icon: "💚",  color: "#43A047" },
  { key: "ruby",     name: "Rubis",    rankOrder: 7, icon: "❤️",  color: "#E53935" },
  { key: "diamond",  name: "Diamant",  rankOrder: 8, icon: "💎",  color: "#29B6F6" },
];

export const LEAGUE_BY_KEY = new Map<LeagueKey, LeagueConfig>(
  LEAGUES.map((l) => [l.key, l]),
);

// Taille max d'un groupe
const MAX_GROUP_SIZE = 30;

// Barèmes XP
export const XP_AWARDS = {
  DAILY_CHALLENGE_COMPLETION: 50,
  CORRECT_ANSWER: 10,
  PERFECT_DAILY_CHALLENGE: 25,
  DAILY_FIRST_ACTIVITY: 20,
  TRAINING_CORRECT_ANSWER: 5,
  CORRECTED_MISTAKE: 10,
} as const satisfies Record<LeagueXpReason, number>;

// Plafonds anti-farming entraînement (par jour)
const TRAINING_FULL_CAP    = 100; // 0-100 XP → 100%
const TRAINING_HALF_CAP    = 200; // 100-200 XP → 50%
// au-delà de 200 XP → 0%

// ============================================================
// Calcul de la semaine ISO en timezone Paris
// ============================================================

export interface LeagueWeek {
  id: string;       // ex: '2026-W35'
  weekStart: string; // YYYY-MM-DD (lundi)
  weekEnd: string;   // YYYY-MM-DD (dimanche)
}

function toParisDateParts(now: Date): { year: number; month: number; day: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    weekday: "short",
    timeZone: APP_TIME_ZONE,
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };

  const weekdayValue = values.weekday ?? "";
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    dayOfWeek: weekdayMap[weekdayValue] ?? 1,
  };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function currentLeagueWeek(now = new Date()): LeagueWeek {
  const { year, month, day, dayOfWeek } = toParisDateParts(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${year}-${pad(month)}-${pad(day)}`;

  // Lundi de cette semaine (dayOfWeek: 1=Mon, 7=Sun)
  const weekStart = addDays(todayStr, -(dayOfWeek - 1));
  const weekEnd   = addDays(weekStart, 6);

  // Numéro de semaine ISO
  const jan4 = new Date(`${year}-01-04T12:00:00Z`);
  const jan4Day = jan4.getUTCDay() || 7; // 1=Mon
  const jan4Monday = new Date(jan4);
  jan4Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const weekStartDate = new Date(`${weekStart}T12:00:00Z`);
  const diffMs = weekStartDate.getTime() - jan4Monday.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  let weekNum = 1 + Math.floor(diffDays / 7);

  // Semaine 0 → semaine 52/53 de l'année précédente
  let weekYear = year;
  if (weekNum < 1) {
    weekYear = year - 1;
    weekNum = isoWeeksInYear(weekYear);
  } else if (weekNum > isoWeeksInYear(year)) {
    weekYear = year + 1;
    weekNum = 1;
  }

  const id = `${weekYear}-W${String(weekNum).padStart(2, "0")}`;
  return { id, weekStart, weekEnd };
}

function isoWeeksInYear(year: number): number {
  // Une année a 53 semaines si le 1er janvier est jeudi, ou si c'est une année bissextile commençant un mercredi
  const dec28 = new Date(`${year}-12-28T12:00:00Z`);
  const dec28Day = dec28.getUTCDay() || 7;
  const dec28Monday = new Date(dec28);
  dec28Monday.setUTCDate(dec28.getUTCDate() - (dec28Day - 1));
  const jan4 = new Date(`${year}-01-04T12:00:00Z`);
  const jan4Day = jan4.getUTCDay() || 7;
  const jan4Monday = new Date(jan4);
  jan4Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  return Math.round((dec28Monday.getTime() - jan4Monday.getTime()) / (86_400_000 * 7)) + 1;
}

// ============================================================
// DB row types
// ============================================================

interface UserLeagueRow {
  league_key: LeagueKey;
}

interface LeagueWeekRow {
  id: string;
  week_start: string;
  week_end: string;
  processed_at: string | null;
}

interface LeagueGroupRow {
  id: string;
  league_week_id: string;
  league_key: LeagueKey;
  group_number: number;
}

interface LeagueMemberRow {
  id: string;
  league_group_id: string;
  user_id: string;
  weekly_xp: number;
  xp_reached_at: string | null;
  final_rank: number | null;
  result: "promoted" | "stayed" | "relegated" | null;
  joined_at: string;
}

interface GroupMemberCountRow {
  count: number;
}

export interface LeagueMember {
  memberId: string;
  groupId: string;
  leagueKey: LeagueKey;
  weeklyXp: number;
  weekId: string;
}

// ============================================================
// Trouver ou créer la semaine actuelle en DB
// ============================================================

async function ensureLeagueWeek(env: Env, week: LeagueWeek): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO league_weeks (id, week_start, week_end)
     VALUES (?1, ?2, ?3)`,
  )
    .bind(week.id, week.weekStart, week.weekEnd)
    .run();
}

// ============================================================
// Trouver ou créer le groupe approprié pour la ligue + semaine
// La logique remplit les groupes progressivement jusqu'à MAX_GROUP_SIZE
// ============================================================

async function ensureLeagueGroup(
  env: Env,
  weekId: string,
  leagueKey: LeagueKey,
): Promise<string> {
  // Chercher le dernier groupe non-plein
  const lastGroup = await env.DB.prepare(
    `SELECT
       lg.id,
       lg.group_number,
       COUNT(lgm.id) AS member_count
     FROM league_groups lg
     LEFT JOIN league_group_members lgm ON lgm.league_group_id = lg.id
     WHERE lg.league_week_id = ?1 AND lg.league_key = ?2
     GROUP BY lg.id
     ORDER BY lg.group_number DESC
     LIMIT 1`,
  )
    .bind(weekId, leagueKey)
    .first<{ id: string; group_number: number; member_count: number }>();

  if (lastGroup && lastGroup.member_count < MAX_GROUP_SIZE) {
    return lastGroup.id;
  }

  // Créer un nouveau groupe
  const newGroupNumber = (lastGroup?.group_number ?? 0) + 1;
  const newGroupId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO league_groups (id, league_week_id, league_key, group_number)
     VALUES (?1, ?2, ?3, ?4)`,
  )
    .bind(newGroupId, weekId, leagueKey, newGroupNumber)
    .run();

  return newGroupId;
}

// ============================================================
// Inscrire l'utilisateur dans un groupe (ou retrouver son inscription)
// Retourne null si l'utilisateur est déjà dans un groupe cette semaine
// ============================================================

async function findCurrentMember(
  env: Env,
  userId: string,
  weekId: string,
): Promise<(LeagueMemberRow & { league_key: LeagueKey; week_id: string }) | null> {
  return env.DB.prepare(
    `SELECT
       lgm.id, lgm.league_group_id, lgm.user_id,
       lgm.weekly_xp, lgm.xp_reached_at,
       lgm.final_rank, lgm.result, lgm.joined_at,
       lg.league_key, lg.league_week_id AS week_id
     FROM league_group_members lgm
     JOIN league_groups lg ON lg.id = lgm.league_group_id
     WHERE lgm.user_id = ?1 AND lg.league_week_id = ?2`,
  )
    .bind(userId, weekId)
    .first<LeagueMemberRow & { league_key: LeagueKey; week_id: string }>();
}

// ============================================================
// Ligue courante de l'utilisateur (permanente)
// ============================================================

async function getUserLeagueKey(env: Env, userId: string): Promise<LeagueKey> {
  const row = await env.DB.prepare(
    `SELECT league_key FROM user_leagues WHERE user_id = ?1`,
  )
    .bind(userId)
    .first<UserLeagueRow>();
  return row?.league_key ?? "iron";
}

// ============================================================
// ensureLeagueMember — POINT D'ENTRÉE PRINCIPAL
// Inscrit l'utilisateur à la ligue si c'est sa première action
// de la semaine. Retourne ses informations de membre.
// ============================================================

export async function ensureLeagueMember(
  env: Env,
  userId: string,
  now = new Date(),
): Promise<LeagueMember | null> {
  const week = currentLeagueWeek(now);

  // Vérifier si déjà membre cette semaine
  let existing = await findCurrentMember(env, userId, week.id);
  if (existing) {
    return {
      memberId: existing.id,
      groupId: existing.league_group_id,
      leagueKey: existing.league_key,
      weeklyXp: existing.weekly_xp,
      weekId: week.id,
    };
  }

  // Première activité de la semaine → inscrire l'utilisateur
  await ensureLeagueWeek(env, week);
  const leagueKey = await getUserLeagueKey(env, userId);
  const groupId = await ensureLeagueGroup(env, week.id, leagueKey);
  const memberId = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `INSERT INTO league_group_members (id, league_group_id, user_id)
       VALUES (?1, ?2, ?3)`,
    )
      .bind(memberId, groupId, userId)
      .run();
  } catch (error) {
    // Contrainte UNIQUE violée = race condition, relire
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      existing = await findCurrentMember(env, userId, week.id);
      if (existing) {
        return {
          memberId: existing.id,
          groupId: existing.league_group_id,
          leagueKey: existing.league_key,
          weeklyXp: existing.weekly_xp,
          weekId: week.id,
        };
      }
    }
    throw error;
  }

  return { memberId, groupId, leagueKey, weeklyXp: 0, weekId: week.id };
}

// ============================================================
// Calcul anti-farming (entraînements classiques)
// Retourne le nombre d'XP réellement crédités après plafonnement
// ============================================================

async function computeTrainingXp(
  env: Env,
  userId: string,
  rawXp: number,
  activityDate: string,
): Promise<{ effective: number; newTotal: number }> {
  const row = await env.DB.prepare(
    `SELECT training_xp FROM league_daily_training_xp
     WHERE user_id = ?1 AND activity_date = ?2`,
  )
    .bind(userId, activityDate)
    .first<{ training_xp: number }>();

  const current = row?.training_xp ?? 0;
  let effective = 0;
  let remaining = rawXp;
  let position = current;

  // Tranche 0-100 : 100%
  if (position < TRAINING_FULL_CAP) {
    const canUse = Math.min(remaining, TRAINING_FULL_CAP - position);
    effective += canUse;
    remaining -= canUse;
    position += canUse;
  }

  // Tranche 100-200 : 50%
  if (remaining > 0 && position < TRAINING_HALF_CAP) {
    const canUse = Math.min(remaining, TRAINING_HALF_CAP - position);
    effective += Math.floor(canUse * 0.5);
    remaining -= canUse;
    position += canUse;
  }

  // Au-delà de 200 : 0%
  return { effective, newTotal: current + rawXp };
}

// ============================================================
// awardLeagueXp — SEUL POINT D'ENTRÉE pour créditer des XP
// ============================================================

export async function awardLeagueXp(
  env: Env,
  userId: string,
  rawAmount: number,
  reason: LeagueXpReason,
  sourceType?: string,
  sourceId?: string,
  now = new Date(),
): Promise<{ awarded: number; totalWeeklyXp: number } | null> {
  // Inscrire l'utilisateur au groupe si besoin
  const member = await ensureLeagueMember(env, userId, now);
  if (!member) return null;

  // Calculer le montant effectif (anti-farming si entraînement)
  const activityDate = currentAppDate(now);
  let effectiveAmount = rawAmount;

  if (reason === "TRAINING_CORRECT_ANSWER" || reason === "CORRECTED_MISTAKE") {
    // CORRECTED_MISTAKE est hors plafond (pédagogique), TRAINING_CORRECT_ANSWER est soumis
    if (reason === "TRAINING_CORRECT_ANSWER") {
      const { effective, newTotal } = await computeTrainingXp(
        env,
        userId,
        rawAmount,
        activityDate,
      );
      effectiveAmount = effective;

      // Mettre à jour le compteur anti-farming
      await env.DB.prepare(
        `INSERT INTO league_daily_training_xp (user_id, activity_date, training_xp)
         VALUES (?1, ?2, ?3)
         ON CONFLICT (user_id, activity_date) DO UPDATE SET
           training_xp = ?3`,
      )
        .bind(userId, activityDate, newTotal)
        .run();
    }
  }

  if (effectiveAmount === 0 && reason === "TRAINING_CORRECT_ANSWER") {
    // Plafond atteint, on n'insère pas d'événement inutile
    const refreshed = await env.DB.prepare(
      `SELECT weekly_xp FROM league_group_members WHERE id = ?1`,
    )
      .bind(member.memberId)
      .first<{ weekly_xp: number }>();
    return { awarded: 0, totalWeeklyXp: refreshed?.weekly_xp ?? member.weeklyXp };
  }

  // Insérer l'événement XP (contrainte UNIQUE protège contre les doublons)
  const eventId = crypto.randomUUID();
  const now_iso = now.toISOString();

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO league_xp_events
           (id, user_id, league_group_member_id, amount, raw_amount, reason, source_type, source_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      ).bind(
        eventId,
        userId,
        member.memberId,
        effectiveAmount,
        rawAmount,
        reason,
        sourceType ?? null,
        sourceId ?? null,
        now_iso,
      ),
      env.DB.prepare(
        `UPDATE league_group_members
         SET weekly_xp = weekly_xp + ?1,
             xp_reached_at = ?2
         WHERE id = ?3`,
      ).bind(effectiveAmount, now_iso, member.memberId),
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      // Double appel, retourner le solde actuel sans modifier
      const refreshed = await env.DB.prepare(
        `SELECT weekly_xp FROM league_group_members WHERE id = ?1`,
      )
        .bind(member.memberId)
        .first<{ weekly_xp: number }>();
      return { awarded: 0, totalWeeklyXp: refreshed?.weekly_xp ?? member.weeklyXp };
    }
    throw error;
  }

  const refreshed = await env.DB.prepare(
    `SELECT weekly_xp FROM league_group_members WHERE id = ?1`,
  )
    .bind(member.memberId)
    .first<{ weekly_xp: number }>();

  return {
    awarded: effectiveAmount,
    totalWeeklyXp: refreshed?.weekly_xp ?? member.weeklyXp + effectiveAmount,
  };
}

// ============================================================
// Classement du groupe de l'utilisateur
// ============================================================

export interface LeaderboardUser {
  rank: number;
  userId: string;
  displayName: string;
  avatarEmoji: string;
  profileColor: string;
  weeklyXp: number;
  zone: "promotion" | "stay" | "relegation";
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  leagueKey: LeagueKey;
  leagueName: string;
  leagueIcon: string;
  leagueColor: string;
  groupId: string;
  weekId: string;
  weekStart: string;
  weekEnd: string;
  currentUserRank: number | null;
  currentUserXp: number;
  totalMembers: number;
  promotionCount: number;
  relegationCount: number;
  xpToPromotionZone: number | null; // XP manquants avant le top N
  users: LeaderboardUser[];
}

function computeZoneCounts(memberCount: number): { promotion: number; relegation: number } {
  if (memberCount >= 20) return { promotion: 5, relegation: 5 };
  if (memberCount >= 10) return { promotion: 3, relegation: 3 };
  if (memberCount >= 5)  return { promotion: 1, relegation: 1 };
  return { promotion: 0, relegation: 0 };
}

function computeZone(
  rank: number,
  memberCount: number,
  promotionCount: number,
  relegationCount: number,
): "promotion" | "stay" | "relegation" {
  if (promotionCount > 0 && rank <= promotionCount) return "promotion";
  if (relegationCount > 0 && rank > memberCount - relegationCount) return "relegation";
  return "stay";
}

export async function getLeagueLeaderboard(
  env: Env,
  userId: string,
  now = new Date(),
): Promise<LeaderboardResponse | null> {
  const week = currentLeagueWeek(now);

  const member = await findCurrentMember(env, userId, week.id);
  if (!member) return null;

  const group = await env.DB.prepare(
    `SELECT id, league_key FROM league_groups WHERE id = ?1`,
  )
    .bind(member.league_group_id)
    .first<{ id: string; league_key: LeagueKey }>();
  if (!group) return null;

  interface MemberWithUserRow {
    user_id: string;
    display_name: string;
    avatar_emoji: string;
    profile_color: string;
    weekly_xp: number;
    xp_reached_at: string | null;
  }

  const { results } = await env.DB.prepare(
    `SELECT
       lgm.user_id,
       u.display_name,
       u.avatar_emoji,
       u.profile_color,
       lgm.weekly_xp,
       lgm.xp_reached_at
     FROM league_group_members lgm
     JOIN users u ON u.id = lgm.user_id
     WHERE lgm.league_group_id = ?1
     ORDER BY lgm.weekly_xp DESC, lgm.xp_reached_at ASC, lgm.joined_at ASC`,
  )
    .bind(member.league_group_id)
    .all<MemberWithUserRow>();

  const members = results;
  const memberCount = members.length;
  const { promotion: promotionCount, relegation: relegationCount } =
    computeZoneCounts(memberCount);

  const leagueConf = LEAGUE_BY_KEY.get(group.league_key as LeagueKey)!;

  let currentUserRank: number | null = null;
  let currentUserXp = 0;
  let xpToPromotionZone: number | null = null;

  const users: LeaderboardUser[] = members.map((m, index) => {
    const rank = index + 1;
    const isCurrentUser = m.user_id === userId;
    if (isCurrentUser) {
      currentUserRank = rank;
      currentUserXp = m.weekly_xp;
    }
    return {
      rank,
      userId: m.user_id,
      displayName: m.display_name,
      avatarEmoji: m.avatar_emoji,
      profileColor: m.profile_color,
      weeklyXp: m.weekly_xp,
      zone: computeZone(rank, memberCount, promotionCount, relegationCount),
      isCurrentUser,
    };
  });

  // XP manquants avant la zone de promotion
  if (promotionCount > 0 && currentUserRank !== null && currentUserRank > promotionCount) {
    const promotionEdge = users[promotionCount - 1];
    if (promotionEdge) {
      xpToPromotionZone = Math.max(0, promotionEdge.weeklyXp - currentUserXp + 1);
    }
  }

  const weekRow = await env.DB.prepare(
    `SELECT week_start, week_end FROM league_weeks WHERE id = ?1`,
  )
    .bind(week.id)
    .first<{ week_start: string; week_end: string }>();

  return {
    leagueKey: group.league_key as LeagueKey,
    leagueName: leagueConf.name,
    leagueIcon: leagueConf.icon,
    leagueColor: leagueConf.color,
    groupId: group.id,
    weekId: week.id,
    weekStart: weekRow?.week_start ?? week.weekStart,
    weekEnd: weekRow?.week_end ?? week.weekEnd,
    currentUserRank,
    currentUserXp,
    totalMembers: memberCount,
    promotionCount,
    relegationCount,
    xpToPromotionZone,
    users,
  };
}

// ============================================================
// Informations ligue de l'utilisateur (sans classement complet)
// ============================================================

export interface LeagueMeResponse {
  leagueKey: LeagueKey;
  leagueName: string;
  leagueIcon: string;
  leagueColor: string;
  weekId: string;
  weekStart: string;
  weekEnd: string;
  weeklyXp: number;
  rank: number | null;
  totalMembers: number;
  zone: "promotion" | "stay" | "relegation" | null;
  promotionCount: number;
  relegationCount: number;
  xpToPromotionZone: number | null;
  isActive: boolean; // false si pas encore inscrit cette semaine
}

export async function getLeagueMe(
  env: Env,
  userId: string,
  now = new Date(),
): Promise<LeagueMeResponse> {
  const week = currentLeagueWeek(now);
  const leagueKey = await getUserLeagueKey(env, userId);
  const leagueConf = LEAGUE_BY_KEY.get(leagueKey as LeagueKey)!;

  const weekRow = await env.DB.prepare(
    `SELECT id, week_start, week_end FROM league_weeks WHERE id = ?1`,
  )
    .bind(week.id)
    .first<{ id: string; week_start: string; week_end: string }>();

  const member = await findCurrentMember(env, userId, week.id);

  if (!member) {
    return {
      leagueKey,
      leagueName: leagueConf.name,
      leagueIcon: leagueConf.icon,
      leagueColor: leagueConf.color,
      weekId: week.id,
      weekStart: weekRow?.week_start ?? week.weekStart,
      weekEnd: weekRow?.week_end ?? week.weekEnd,
      weeklyXp: 0,
      rank: null,
      totalMembers: 0,
      zone: null,
      promotionCount: 0,
      relegationCount: 0,
      xpToPromotionZone: null,
      isActive: false,
    };
  }

  // Calculer le rang
  const rankRow = await env.DB.prepare(
    `SELECT COUNT(*) + 1 AS rank FROM league_group_members
     WHERE league_group_id = ?1
       AND (weekly_xp > ?2
            OR (weekly_xp = ?2 AND xp_reached_at < ?3))`,
  )
    .bind(
      member.league_group_id,
      member.weekly_xp,
      member.xp_reached_at ?? "9999-12-31",
    )
    .first<{ rank: number }>();

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM league_group_members WHERE league_group_id = ?1`,
  )
    .bind(member.league_group_id)
    .first<{ count: number }>();

  const rank = rankRow?.rank ?? 1;
  const memberCount = countRow?.count ?? 1;
  const { promotion: promotionCount, relegation: relegationCount } =
    computeZoneCounts(memberCount);
  const zone = computeZone(rank, memberCount, promotionCount, relegationCount);

  // XP avant la zone de promotion
  let xpToPromotionZone: number | null = null;
  if (promotionCount > 0 && rank > promotionCount) {
    const edgeRow = await env.DB.prepare(
      `SELECT weekly_xp FROM league_group_members
       WHERE league_group_id = ?1
       ORDER BY weekly_xp DESC, xp_reached_at ASC, joined_at ASC
       LIMIT 1 OFFSET ?2`,
    )
      .bind(member.league_group_id, promotionCount - 1)
      .first<{ weekly_xp: number }>();
    if (edgeRow) {
      xpToPromotionZone = Math.max(0, edgeRow.weekly_xp - member.weekly_xp + 1);
    }
  }

  return {
    leagueKey,
    leagueName: leagueConf.name,
    leagueIcon: leagueConf.icon,
    leagueColor: leagueConf.color,
    weekId: week.id,
    weekStart: weekRow?.week_start ?? week.weekStart,
    weekEnd: weekRow?.week_end ?? week.weekEnd,
    weeklyXp: member.weekly_xp,
    rank,
    totalMembers: memberCount,
    zone,
    promotionCount,
    relegationCount,
    xpToPromotionZone,
    isActive: true,
  };
}

// ============================================================
// Traitement de fin de semaine (idempotent)
// ============================================================

export async function processLeagueWeek(
  env: Env,
  weekId: string,
): Promise<{ processed: boolean; alreadyDone: boolean }> {
  // Vérifier si déjà traité
  const weekRow = await env.DB.prepare(
    `SELECT id, processed_at FROM league_weeks WHERE id = ?1`,
  )
    .bind(weekId)
    .first<{ id: string; processed_at: string | null }>();

  if (!weekRow) return { processed: false, alreadyDone: false };
  if (weekRow.processed_at) return { processed: false, alreadyDone: true };

  // Récupérer tous les groupes de la semaine
  const { results: groups } = await env.DB.prepare(
    `SELECT id, league_key FROM league_groups WHERE league_week_id = ?1`,
  )
    .bind(weekId)
    .all<{ id: string; league_key: LeagueKey }>();

  for (const group of groups) {
    await processGroup(env, group.id, group.league_key, weekId);
  }

  // Marquer comme traitée (atomique : si un autre processus a déjà mis à jour, pas grave)
  await env.DB.prepare(
    `UPDATE league_weeks
     SET processed_at = CURRENT_TIMESTAMP
     WHERE id = ?1 AND processed_at IS NULL`,
  )
    .bind(weekId)
    .run();

  return { processed: true, alreadyDone: false };
}

async function processGroup(
  env: Env,
  groupId: string,
  leagueKey: LeagueKey,
  weekId: string,
): Promise<void> {
  interface GroupMember {
    id: string;
    user_id: string;
    weekly_xp: number;
    xp_reached_at: string | null;
    joined_at: string;
  }

  const { results: members } = await env.DB.prepare(
    `SELECT id, user_id, weekly_xp, xp_reached_at, joined_at
     FROM league_group_members
     WHERE league_group_id = ?1
     ORDER BY weekly_xp DESC, xp_reached_at ASC, joined_at ASC`,
  )
    .bind(groupId)
    .all<GroupMember>();

  if (members.length === 0) return;

  const memberCount = members.length;
  const { promotion: promotionCount, relegation: relegationCount } =
    computeZoneCounts(memberCount);
  const leagueConf = LEAGUE_BY_KEY.get(leagueKey)!;

  for (let i = 0; i < members.length; i++) {
    const member = members[i]!;
    const rank = i + 1;
    let result: "promoted" | "stayed" | "relegated";
    let newLeagueKey = leagueKey;

    if (promotionCount > 0 && rank <= promotionCount) {
      result = "promoted";
      // Trouver la ligue suivante (max Diamant)
      const nextLeague = LEAGUES.find((l) => l.rankOrder === leagueConf.rankOrder + 1);
      newLeagueKey = nextLeague?.key ?? leagueKey;
    } else if (relegationCount > 0 && rank > memberCount - relegationCount) {
      result = "relegated";
      // Trouver la ligue précédente (min Fer)
      const prevLeague = LEAGUES.find((l) => l.rankOrder === leagueConf.rankOrder - 1);
      newLeagueKey = prevLeague?.key ?? leagueKey;
    } else {
      result = "stayed";
    }

    const historyId = crypto.randomUUID();

    await env.DB.batch([
      // Mettre à jour le membre
      env.DB.prepare(
        `UPDATE league_group_members
         SET final_rank = ?1, result = ?2
         WHERE id = ?3`,
      ).bind(rank, result, member.id),
      // Mettre à jour la ligue permanente
      env.DB.prepare(
        `INSERT INTO user_leagues (user_id, league_key, updated_at)
         VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
           league_key = ?2, updated_at = CURRENT_TIMESTAMP`,
      ).bind(member.user_id, newLeagueKey),
      // Enregistrer l'historique
      env.DB.prepare(
        `INSERT OR IGNORE INTO league_history
           (id, user_id, league_week_id, league_key, group_id, final_rank, weekly_xp, result)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(
        historyId,
        member.user_id,
        weekId,
        leagueKey,
        groupId,
        rank,
        member.weekly_xp,
        result,
      ),
    ]);
  }
}

// ============================================================
// Historique de l'utilisateur
// ============================================================

export interface LeagueHistoryEntry {
  weekId: string;
  weekStart: string;
  leagueKey: LeagueKey;
  leagueName: string;
  leagueIcon: string;
  finalRank: number;
  weeklyXp: number;
  result: "promoted" | "stayed" | "relegated";
  recordedAt: string;
}

export async function getLeagueHistory(
  env: Env,
  userId: string,
): Promise<LeagueHistoryEntry[]> {
  interface HistoryRow {
    week_id: string;
    week_start: string;
    league_key: LeagueKey;
    final_rank: number;
    weekly_xp: number;
    result: "promoted" | "stayed" | "relegated";
    recorded_at: string;
  }

  const { results } = await env.DB.prepare(
    `SELECT
       lh.league_week_id AS week_id,
       lw.week_start,
       lh.league_key,
       lh.final_rank,
       lh.weekly_xp,
       lh.result,
       lh.recorded_at
     FROM league_history lh
     JOIN league_weeks lw ON lw.id = lh.league_week_id
     WHERE lh.user_id = ?1
     ORDER BY lh.recorded_at DESC
     LIMIT 20`,
  )
    .bind(userId)
    .all<HistoryRow>();

  return results.map((row) => {
    const conf = LEAGUE_BY_KEY.get(row.league_key) ?? LEAGUES[0]!;
    return {
      weekId: row.week_id,
      weekStart: row.week_start,
      leagueKey: row.league_key,
      leagueName: conf.name,
      leagueIcon: conf.icon,
      finalRank: row.final_rank,
      weeklyXp: row.weekly_xp,
      result: row.result,
      recordedAt: row.recorded_at,
    };
  });
}

// ============================================================
// Helpers admin
// ============================================================

export interface AdminLeagueOverview {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  processedAt: string | null;
  groups: Array<{
    groupId: string;
    leagueKey: LeagueKey;
    leagueName: string;
    groupNumber: number;
    memberCount: number;
    weeklyXp: number;
  }>;
  totalActivePlayers: number;
  totalGroups: number;
  totalWeeklyXp: number;
}

export interface AdminLeagueStats {
  currentWeek: LeagueWeek;
  totals: {
    players: number;
    activePlayers: number;
    groups: number;
    weeklyXp: number;
    averageXpPerActivePlayer: number;
  };
  leagues: Array<LeagueConfig & {
    players: number;
    activePlayers: number;
    groups: number;
    weeklyXp: number;
  }>;
  outcomes: {
    promoted: number;
    stayed: number;
    relegated: number;
    total: number;
  };
  weeks: AdminLeagueOverview[];
}

interface AdminLeagueDistributionRow {
  league_key: LeagueKey;
  player_count: number;
}

interface AdminLeagueActivityRow {
  active_players: number;
  group_count: number;
  league_key: LeagueKey;
  weekly_xp: number;
}

interface AdminLeagueOutcomeRow {
  promoted: number;
  relegated: number;
  stayed: number;
  total: number;
}

interface AdminLeagueGroupOverviewRow {
  group_id: string;
  group_number: number;
  league_key: LeagueKey;
  league_week_id: string;
  member_count: number;
  weekly_xp: number;
}

export async function getAdminLeagueOverview(
  env: Env,
): Promise<AdminLeagueOverview[]> {
  const { results: weeks } = await env.DB.prepare(
    `SELECT id, week_start, week_end, processed_at
     FROM league_weeks
     ORDER BY week_start DESC
     LIMIT 10`,
  ).all<{ id: string; week_start: string; week_end: string; processed_at: string | null }>();

  const { results: allGroups } = await env.DB.prepare(
    `SELECT
       lg.id AS group_id,
       lg.league_week_id,
       lg.league_key,
       lg.group_number,
       COUNT(lgm.id) AS member_count,
       COALESCE(SUM(lgm.weekly_xp), 0) AS weekly_xp
     FROM league_groups lg
     LEFT JOIN league_group_members lgm ON lgm.league_group_id = lg.id
     WHERE lg.league_week_id IN (
       SELECT id FROM league_weeks ORDER BY week_start DESC LIMIT 10
     )
     GROUP BY lg.id
     ORDER BY lg.league_week_id DESC, lg.league_key, lg.group_number`,
  ).all<AdminLeagueGroupOverviewRow>();

  return weeks.map((week) => {
    const groups = allGroups.filter((group) => group.league_week_id === week.id);
    const totalActivePlayers = groups.reduce((sum, g) => sum + g.member_count, 0);
    const totalWeeklyXp = groups.reduce((sum, group) => sum + group.weekly_xp, 0);

    return {
      weekId: week.id,
      weekStart: week.week_start,
      weekEnd: week.week_end,
      processedAt: week.processed_at,
      groups: groups.map((g) => ({
        groupId: g.group_id,
        leagueKey: g.league_key,
        leagueName: LEAGUE_BY_KEY.get(g.league_key)?.name ?? g.league_key,
        groupNumber: g.group_number,
        memberCount: g.member_count,
        weeklyXp: g.weekly_xp,
      })),
      totalActivePlayers,
      totalGroups: groups.length,
      totalWeeklyXp,
    };
  });
}

export async function getAdminLeagueStats(env: Env): Promise<AdminLeagueStats> {
  const week = currentLeagueWeek();
  const { results: distributionRows } = await env.DB.prepare(
    `SELECT
       COALESCE(ul.league_key, 'iron') AS league_key,
       COUNT(*) AS player_count
     FROM users u
     LEFT JOIN user_leagues ul ON ul.user_id = u.id
     GROUP BY COALESCE(ul.league_key, 'iron')`,
  ).all<AdminLeagueDistributionRow>();

  const { results: activityRows } = await env.DB.prepare(
    `SELECT
       lg.league_key,
       COUNT(DISTINCT lg.id) AS group_count,
       COUNT(lgm.id) AS active_players,
       COALESCE(SUM(lgm.weekly_xp), 0) AS weekly_xp
     FROM league_groups lg
     LEFT JOIN league_group_members lgm ON lgm.league_group_id = lg.id
     WHERE lg.league_week_id = ?1
     GROUP BY lg.league_key`,
  )
    .bind(week.id)
    .all<AdminLeagueActivityRow>();

  const outcomeRow = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN result = 'promoted' THEN 1 ELSE 0 END), 0) AS promoted,
       COALESCE(SUM(CASE WHEN result = 'stayed' THEN 1 ELSE 0 END), 0) AS stayed,
       COALESCE(SUM(CASE WHEN result = 'relegated' THEN 1 ELSE 0 END), 0) AS relegated
     FROM league_history`,
  ).first<AdminLeagueOutcomeRow>();

  const playerCounts = new Map(
    distributionRows.map((row) => [row.league_key, row.player_count]),
  );
  const currentActivity = new Map(activityRows.map((row) => [row.league_key, row]));
  const leagues = LEAGUES.map((league) => {
    const activity = currentActivity.get(league.key);
    return {
      ...league,
      players: playerCounts.get(league.key) ?? 0,
      activePlayers: activity?.active_players ?? 0,
      groups: activity?.group_count ?? 0,
      weeklyXp: activity?.weekly_xp ?? 0,
    };
  });
  const activePlayers = leagues.reduce((sum, league) => sum + league.activePlayers, 0);
  const weeklyXp = leagues.reduce((sum, league) => sum + league.weeklyXp, 0);

  return {
    currentWeek: week,
    totals: {
      players: leagues.reduce((sum, league) => sum + league.players, 0),
      activePlayers,
      groups: leagues.reduce((sum, league) => sum + league.groups, 0),
      weeklyXp,
      averageXpPerActivePlayer: activePlayers === 0 ? 0 : Math.round(weeklyXp / activePlayers),
    },
    leagues,
    outcomes: outcomeRow ?? { total: 0, promoted: 0, stayed: 0, relegated: 0 },
    weeks: await getAdminLeagueOverview(env),
  };
}
