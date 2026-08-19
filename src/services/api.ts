import type {
  AdminCatalog,
  AdminOverview,
  AdminQuestion,
  AdminQuestionInput,
  AdminTheme,
  AdminThemeInput,
  AdminThemesResponse,
  AdminUser,
  AdminUsersResponse,
  AuthResponse,
  DashboardData,
  LoginInput,
  RegisterInput,
  SchoolLevelsResponse,
  SubjectSummary,
  UpdateAdminUserInput,
  UpdateProfileInput,
  UserRole,
} from "@/types/domain";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    let message = `La requête a échoué (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
      ) {
        message = body.error;
      }
    } catch {
      // Le message de secours contient déjà le statut HTTP utile au diagnostic.
    }

    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function patchJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export const api = {
  admin: {
    overview: () => requestJson<AdminOverview>("/api/admin/overview"),
    users: (role: UserRole | "all" = "all", offset = 0) =>
      requestJson<AdminUsersResponse>(
        `/api/admin/users?role=${encodeURIComponent(role)}&offset=${offset}&limit=50`,
      ),
    updateUser: (userId: string, input: UpdateAdminUserInput) =>
      patchJson<{ user: AdminUser }>(`/api/admin/users/${encodeURIComponent(userId)}`, input),
    catalog: () => requestJson<AdminCatalog>("/api/admin/catalog"),
    themes: (offset = 0) =>
      requestJson<AdminThemesResponse>(`/api/admin/themes?offset=${offset}&limit=50`),
    createTheme: (input: AdminThemeInput) =>
      postJson<{ theme: AdminTheme }>("/api/admin/themes", input),
    updateTheme: (themeId: string, input: AdminThemeInput) =>
      patchJson<{ theme: AdminTheme }>(
        `/api/admin/themes/${encodeURIComponent(themeId)}`,
        input,
      ),
    questions: (themeId: string) =>
      requestJson<{ questions: AdminQuestion[] }>(
        `/api/admin/questions?themeId=${encodeURIComponent(themeId)}`,
      ),
    createQuestion: (input: AdminQuestionInput) =>
      postJson<{ question: AdminQuestion }>("/api/admin/questions", input),
    updateQuestion: (questionId: string, input: AdminQuestionInput) =>
      patchJson<{ question: AdminQuestion }>(
        `/api/admin/questions/${encodeURIComponent(questionId)}`,
        input,
      ),
  },
  dashboard: () => requestJson<DashboardData>("/api/dashboard"),
  subjects: (level = "6e") =>
    requestJson<SubjectSummary[]>(`/api/subjects?level=${encodeURIComponent(level)}`),
  auth: {
    me: () => requestJson<AuthResponse>("/api/auth/me"),
    login: (input: LoginInput) => postJson<AuthResponse>("/api/auth/login", input),
    register: (input: RegisterInput) => postJson<AuthResponse>("/api/auth/register", input),
    logout: () => postJson<{ success: true }>("/api/auth/logout"),
    updateProfile: (input: UpdateProfileInput) =>
      patchJson<AuthResponse>("/api/auth/me", input),
  },
  schoolLevels: () => requestJson<SchoolLevelsResponse>("/api/school-levels"),
};
