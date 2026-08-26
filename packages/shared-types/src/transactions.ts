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
