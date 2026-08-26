export interface GoalDto {
  id: string;
  userId: string;
  accountId: string | null;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalRequest {
  accountId?: string;
  name: string;
  targetAmount: string;
  targetDate?: string;
}

export interface UpdateGoalRequest {
  name?: string;
  targetAmount?: string;
  targetDate?: string;
}

// currentAmount n'est jamais stocké : toujours recalculé à partir des GoalContribution.
export interface GoalProgressDto {
  goalId: string;
  name: string;
  accountId: string | null;
  targetAmount: string;
  targetDate: string | null;
  currentAmount: string;
  remaining: string;
  // Pourcentage non plafonné (peut dépasser 100 si l'utilisateur a épargné au-delà de sa cible).
  percentage: number;
  isAchieved: boolean;
}

export interface GoalContributionDto {
  id: string;
  goalId: string;
  amount: string;
  note: string | null;
  contributedAt: string;
  createdAt: string;
}

export interface CreateGoalContributionRequest {
  amount: string;
  note?: string;
  contributedAt?: string;
}
