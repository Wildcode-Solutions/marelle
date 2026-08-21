export interface SchoolLevel {
  id: string;
  label: string;
}

export type UserRole = "student" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  avatarEmoji: string;
  schoolLevel: SchoolLevel;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface SchoolLevelsResponse {
  schoolLevels: SchoolLevel[];
}

export interface UpdateProfileInput {
  schoolLevelId: string;
}

export interface AdminOverview {
  users: {
    total: number;
    students: number;
    admins: number;
  };
  activeSessions: number;
  activeSubjects: number;
  content: {
    questions: number;
    answers: number;
  };
}

export interface Pagination {
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarEmoji: string;
  schoolLevel: SchoolLevel;
  xp: number;
  createdAt: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: Pagination;
}

export interface UpdateAdminUserInput {
  displayName?: string;
  email?: string;
  schoolLevelId?: string;
  role?: UserRole;
}

export interface AdminSubject {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  isActive: boolean;
  themeCount: number;
}

export interface AdminSubjectInput {
  name: string;
  shortName: string;
  icon: string;
  color: string;
  isActive: boolean;
}

export interface AdminSubjectsResponse {
  subjects: AdminSubject[];
}

export interface AdminCatalog {
  schoolLevels: SchoolLevel[];
  subjects: Array<Pick<AdminSubject, "id" | "name" | "shortName" | "icon" | "color">>;
}

export interface AdminTheme {
  id: string;
  title: string;
  slug: string;
  summary: string;
  position: number;
  isActive: boolean;
  questionCount: number;
  subject: Pick<AdminSubject, "id" | "name" | "icon">;
  schoolLevel: SchoolLevel;
}

export interface AdminThemeInput {
  title: string;
  summary: string;
  subjectId: string;
  schoolLevelId: string;
  position: number;
  isActive: boolean;
}

export interface AdminThemesResponse {
  themes: AdminTheme[];
  pagination: Pagination;
}

export type QuestionKind = "multiple_choice" | "true_false" | "short_answer";
export type QuestionStatus = "draft" | "published" | "archived";

export interface AdminAnswerChoice {
  id?: string;
  label: string;
  isCorrect: boolean;
  position?: number;
}

export interface AdminQuestion {
  id: string;
  themeId: string;
  themeTitle: string;
  kind: QuestionKind;
  prompt: string;
  explanation: string;
  expectedAnswer: string | null;
  difficulty: number;
  xpReward: number;
  status: QuestionStatus;
  choices: AdminAnswerChoice[];
}

export interface AdminQuestionInput {
  themeId: string;
  kind: QuestionKind;
  prompt: string;
  explanation: string;
  expectedAnswer: string | null;
  difficulty: number;
  xpReward: number;
  status: QuestionStatus;
  choices: AdminAnswerChoice[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}

export interface UserSummary {
  id: string;
  role: UserRole;
  displayName: string;
  avatarEmoji: string;
  schoolLevel: SchoolLevel;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lives: number;
}

export interface TodayProgress {
  earnedXp: number;
  goalXp: number;
  completedSessions: number;
  answeredQuestions: number;
  correctAnswers: number;
}

export interface SubjectSummary {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  chapterCount: number;
}

export interface DashboardData {
  user: UserSummary;
  today: TodayProgress;
  subjects: SubjectSummary[];
}
