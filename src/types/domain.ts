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
  profileColor: string;
  schoolLevel: SchoolLevel;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface SchoolLevelsResponse {
  schoolLevels: SchoolLevel[];
}

export interface UpdateProfileInput {
  avatarEmoji?: string;
  displayName?: string;
  profileColor?: string;
  schoolLevelId?: string;
}

export interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ProfileStats {
  bestScorePercentage: number;
  completedChallenges: number;
  currentStreak: number;
  level: number;
  longestStreak: number;
  xp: number;
}

export interface ProfileBadge {
  description: string;
  icon: string;
  id: string;
  name: string;
  slug: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface ProfileResponse {
  badges: ProfileBadge[];
  stats: ProfileStats;
}

export interface ProgressionDay {
  answeredQuestions: number;
  completedSessions: number;
  correctAnswers: number;
  date: string;
  earnedXp: number;
  goalReached: boolean;
}

export interface ProgressionMistake {
  attempts: number;
  chapterTitle: string;
  correctAnswer: string;
  correctAnswers: number;
  explanation: string;
  lastAnsweredAt: string;
  prompt: string;
  questionId: string;
  subject: {
    color: string;
    icon: string;
    name: string;
  };
}

export interface ProgressionChallengeHistory {
  challengeId: string;
  completedAt: string;
  date: string;
  durationSeconds: number | null;
  id: string;
  percentage: number;
  score: number;
  title: string;
  totalQuestions: number;
}

export interface ProgressionResponse {
  activity: ProgressionDay[];
  history: ProgressionChallengeHistory[];
  mistakes: ProgressionMistake[];
  today: string;
}

export interface AdminOverview {
  users: {
    total: number;
    students: number;
    admins: number;
  };
  activeSessions: number;
  connections: {
    total: number;
    last24Hours: number;
    last7Days: number;
    activeUsersLast7Days: number;
    lastAt: string | null;
    recent: Array<{
      id: string;
      userId: string;
      displayName: string;
      email: string;
      avatarEmoji: string;
      kind: "registration" | "login";
      occurredAt: string;
    }>;
  };
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
  loginCount: number;
  lastLoginAt: string | null;
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

export type QuestionKind =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "numeric"
  | "fill_in_blank"
  | "ordering"
  | "matching";
export type QuestionStatus = "draft" | "published" | "archived";

export interface AdminAnswerChoice {
  id?: string;
  label: string;
  isCorrect: boolean;
  position?: number;
}

export interface AdminQuestionItem {
  id?: string;
  prompt: string;
  answer: string;
  acceptedAnswers: string[];
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
  numericTolerance: number | null;
  answerUnit: string | null;
  difficulty: number;
  xpReward: number;
  status: QuestionStatus;
  choices: AdminAnswerChoice[];
  items: AdminQuestionItem[];
}

export interface AdminQuestionInput {
  themeId: string;
  kind: QuestionKind;
  prompt: string;
  explanation: string;
  expectedAnswer: string | null;
  numericTolerance: number | null;
  answerUnit: string | null;
  difficulty: number;
  xpReward: number;
  status: QuestionStatus;
  choices: AdminAnswerChoice[];
  items: AdminQuestionItem[];
}

export type DailyChallengeStoredStatus = "draft" | "published";
export type DailyChallengeEffectiveStatus = "draft" | "scheduled" | "active" | "finished";

export interface AdminDailyChallengeQuestion {
  id: string;
  prompt: string;
  kind: QuestionKind;
  difficulty: number;
  position: number;
  theme: { id: string; title: string };
  subject: Pick<AdminSubject, "id" | "name" | "icon">;
}

export interface AdminDailyChallenge {
  id: string;
  date: string;
  title: string;
  status: DailyChallengeStoredStatus;
  effectiveStatus: DailyChallengeEffectiveStatus;
  questionCount: number;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
  questions: AdminDailyChallengeQuestion[];
}

export interface AdminDailyChallengeInput {
  publicationDate: string;
  title: string;
  status: DailyChallengeStoredStatus;
  questionIds: string[];
}

export interface AdminDailyQuestion {
  id: string;
  prompt: string;
  kind: QuestionKind;
  difficulty: number;
  theme: { id: string; title: string };
  schoolLevel: SchoolLevel;
  subject: Pick<AdminSubject, "id" | "name" | "icon">;
}

export interface DailyChallengeChoice {
  id: string;
  label: string;
}

export interface DailyChallengeQuestion {
  id: string;
  kind: QuestionKind;
  prompt: string;
  difficulty: number;
  position: number;
  choices: DailyChallengeChoice[];
  answerUnit: string | null;
  blankCount: number;
  orderingItems: Array<{ id: string; label: string }>;
  matchingPrompts: Array<{ position: number; label: string }>;
  matchingOptions: Array<{ id: string; label: string }>;
}

export interface DailyChallengeParticipation {
  status: "available" | "in_progress" | "completed";
  attemptId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  score: number;
  totalQuestions: number;
  answers: Array<{ questionId: string; isCorrect: boolean }>;
  currentStreak: number | null;
}

export interface DailyChallenge {
  id: string;
  date: string;
  title: string;
  questionCount: number;
  estimatedMinutes: number;
  questions: DailyChallengeQuestion[];
  participation: DailyChallengeParticipation;
}

export interface DailyChallengeResponse {
  challenge: DailyChallenge | null;
}

export interface DailyChallengeAnswerInput {
  attemptId: string;
  questionId: string;
  answerChoiceId: string | null;
  answerText: string | null;
  blankAnswers: string[] | null;
  orderedItemIds: string[] | null;
  matches: Array<{ promptPosition: number; answerItemId: string }> | null;
  responseTimeMs: number;
}

export interface DailyChallengeAnswerResponse {
  feedback: {
    correctAnswer: string;
    explanation: string;
    isCorrect: boolean;
  };
  progress: {
    answered: number;
    score: number;
    total: number;
    readyToFinish: boolean;
  };
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
  profileColor: string;
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

// ================================================================
// Système de ligues
// ================================================================

export type LeagueKey =
  | "iron"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "emerald"
  | "ruby"
  | "diamond";

export type LeagueZone = "promotion" | "stay" | "relegation";

export interface LeagueSummary {
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
  zone: LeagueZone | null;
  promotionCount: number;
  relegationCount: number;
  xpToPromotionZone: number | null;
  isActive: boolean;
}

export interface LeagueMe {
  league: LeagueSummary;
}

export interface LeaderboardUser {
  rank: number;
  userId: string;
  displayName: string;
  avatarEmoji: string;
  profileColor: string;
  weeklyXp: number;
  zone: LeagueZone;
  isCurrentUser: boolean;
}

export interface LeagueLeaderboard {
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
  xpToPromotionZone: number | null;
  users: LeaderboardUser[];
}

export interface LeagueLeaderboardResponse {
  leaderboard: LeagueLeaderboard | null;
}

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

export interface LeagueHistoryResponse {
  history: LeagueHistoryEntry[];
}

export interface AdminLeagueStats {
  currentWeek: {
    id: string;
    weekStart: string;
    weekEnd: string;
  };
  totals: {
    players: number;
    activePlayers: number;
    groups: number;
    weeklyXp: number;
    averageXpPerActivePlayer: number;
  };
  leagues: Array<{
    key: LeagueKey;
    name: string;
    rankOrder: number;
    icon: string;
    color: string;
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
  weeks: Array<{
    weekId: string;
    weekStart: string;
    weekEnd: string;
    processedAt: string | null;
    totalActivePlayers: number;
    totalGroups: number;
    totalWeeklyXp: number;
    groups: Array<{
      groupId: string;
      leagueKey: LeagueKey;
      leagueName: string;
      groupNumber: number;
      memberCount: number;
      weeklyXp: number;
    }>;
  }>;
}

export interface LeagueXpBreakdown {
  reason: string;
  awarded: number;
}

export interface DailyChallengeFinishLeague {
  league: LeagueSummary;
  leagueXp: {
    totalAwarded: number;
    breakdown: LeagueXpBreakdown[];
  };
}
