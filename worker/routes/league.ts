import { json } from "../lib/http";
import {
  getLeagueMe,
  getLeagueLeaderboard,
  getLeagueHistory,
} from "../lib/league";

export async function leagueMe(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const data = await getLeagueMe(env, userId);
  return json(request, { league: data });
}

export async function leagueLeaderboard(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const data = await getLeagueLeaderboard(env, userId);
  if (!data) {
    return json(request, { leaderboard: null });
  }
  return json(request, { leaderboard: data });
}

export async function leagueHistory(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const entries = await getLeagueHistory(env, userId);
  return json(request, { history: entries });
}
