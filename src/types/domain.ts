export interface SchoolLevel {
  id: string;
  label: string;
}

export type UserRole = "student" | "admin";

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
