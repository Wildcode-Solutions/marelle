// Source unique de vérité pour la configuration des ligues côté frontend.
// Doit rester synchronisé avec worker/lib/league.ts

export interface LeagueConfig {
  key: string;
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

export const LEAGUE_BY_KEY = new Map<string, LeagueConfig>(
  LEAGUES.map((l) => [l.key, l]),
);
