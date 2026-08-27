export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface TransactionDto {
  id: string;
  accountId: string;
  type: TransactionType;
  // Toujours positif : le sens (+/-) sur le solde du compte dépend de `type`.
  amount: string;
  categoryId: string | null;
  transferToAccountId: string | null;
  description: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRequest {
  accountId: string;
  type: TransactionType;
  amount: string;
  categoryId?: string;
  transferToAccountId?: string;
  description?: string;
  occurredAt?: string;
}

// type/accountId/transferToAccountId/occurredAt ne sont jamais modifiables après création
// (voir le commentaire sur UpdateTransactionDto côté API pour le pourquoi).
export interface UpdateTransactionRequest {
  amount?: string;
  categoryId?: string;
  description?: string;
}

// Le total revenus/dépenses exclut toujours les transactions de type "transfer" :
// ce ne sont jamais des revenus ni des dépenses, seulement un mouvement entre comptes.
export interface TransactionSummaryDto {
  accountId: string;
  from: string;
  to: string;
  totalIncome: string;
  totalExpense: string;
  netFlow: string;
}

// Même règle d'exclusion des transferts, mais agrégée sur tous les comptes de l'utilisateur
// plutôt qu'un seul (utilisé par le domaine Reports).
export interface TransactionUserSummaryDto {
  userId: string;
  from: string;
  to: string;
  totalIncome: string;
  totalExpense: string;
  netFlow: string;
}

export interface MonthlyAmountPoint {
  month: string; // "YYYY-MM"
  totalIncome: string;
  totalExpense: string;
}

export interface ExpenseCategoryBreakdown {
  categoryId: string;
  categoryLabel: string;
  total: string;
}

// Tout ce dont le tableau de bord a besoin en un seul appel : chiffres du mois courant et
// du mois précédent (pour l'évolution), série mensuelle (revenus vs dépenses) et répartition
// des dépenses du mois par catégorie — toujours calculé depuis les transactions réellement
// saisies par l'utilisateur, jamais de donnée fictive.
export interface DashboardOverviewDto {
  currentMonth: { totalIncome: string; totalExpense: string; netFlow: string };
  previousMonth: { totalIncome: string; totalExpense: string };
  monthlySeries: MonthlyAmountPoint[];
  expenseByCategory: ExpenseCategoryBreakdown[];
}

// Vue d'ensemble des revenus saisis manuellement par l'utilisateur, tous comptes confondus.
// evolutionVsPreviousMonth est un pourcentage (ex: "12.5" = +12.5%), null quand le mois
// précédent n'a aucun revenu enregistré (division impossible, jamais affiché comme 0%).
export interface RevenueOverviewDto {
  userId: string;
  today: string;
  thisWeek: string;
  thisMonth: string;
  thisYear: string;
  allTime: string;
  averageMonthly: string;
  evolutionVsPreviousMonth: string | null;
  generatedAt: string;
}
