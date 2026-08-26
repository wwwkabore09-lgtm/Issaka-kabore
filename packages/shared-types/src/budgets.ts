export interface BudgetDto {
  id: string;
  accountId: string;
  categoryId: string;
  amount: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBudgetRequest {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  userId: string;
  accountId: string;
  categoryId: string;
  amount: string;
}

export interface UpdateBudgetRequest {
  amount: string;
}

// La progression n'est jamais stockée : toujours recalculée à la demande à partir des
// transactions de type expense sur la période demandée (mois courant par défaut).
export interface BudgetProgressDto {
  budgetId: string;
  accountId: string;
  categoryId: string;
  categoryLabel: string;
  from: string;
  to: string;
  limit: string;
  spent: string;
  remaining: string;
  // Pourcentage non plafonné : peut dépasser 100 en cas de dépassement du budget.
  percentage: number;
}
