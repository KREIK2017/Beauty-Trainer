import type { User } from "./auth";
import type { LearningAccess } from "./access";
import type { Progress } from "./schema";

export interface SiteSettings {
  registrationOpen: boolean;
  updatedAt: string;
}
export interface AdminAccount extends User {
  created_at: string;
  last_login_at: string | null;
  last_practice_at: string | null;
  xp: number;
  answers: number;
  correct_answers: number;
  sessions: number;
  mastered_products: number;
  weak_products: number;
}
export interface AdminAccounts {
  users: AdminAccount[];
  total: number;
  page: number;
  pageSize: number;
  summary: { accounts: number; activeLearners: number; totalXp: number };
}
export interface AdminAccountDetail {
  access: LearningAccess;
  account: AdminAccount;
  progress: (Progress & { name: string })[];
  recentAnswers: {
    id: string;
    topic: string;
    correct: number;
    xp: number;
    created_at: string;
  }[];
}
