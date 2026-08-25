import { json, readJsonObject } from "../lib/http";
import { HttpError } from "../lib/http";
import {
  getAdminLeagueStats,
  processLeagueWeek,
  currentLeagueWeek,
} from "../lib/league";

export async function adminLeagues(
  request: Request,
  env: Env,
): Promise<Response> {
  return json(request, await getAdminLeagueStats(env));
}

export async function adminProcessLeagues(
  request: Request,
  env: Env,
): Promise<Response> {
  // Permet de cibler une semaine spécifique via ?weekId ou utilise la semaine précédente
  const url = new URL(request.url);
  let weekId = url.searchParams.get("weekId");

  if (!weekId) {
    // Semaine précédente par défaut
    const now = new Date();
    now.setDate(now.getDate() - 7);
    weekId = currentLeagueWeek(now).id;
  }

  // Valider le format
  if (!/^\d{4}-W\d{2}$/.test(weekId)) {
    throw new HttpError(400, "Format de semaine invalide. Exemple : 2026-W35");
  }

  const result = await processLeagueWeek(env, weekId);
  return json(request, {
    weekId,
    processed: result.processed,
    alreadyDone: result.alreadyDone,
  });
}
