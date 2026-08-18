import type { DashboardData, SubjectSummary } from "@/types/domain";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`La requête a échoué (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  dashboard: () => getJson<DashboardData>("/api/dashboard"),
  subjects: (level = "6e") =>
    getJson<SubjectSummary[]>(`/api/subjects?level=${encodeURIComponent(level)}`),
};
