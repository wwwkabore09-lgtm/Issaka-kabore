// "debt" = j'ai emprunté (je dois) ; "credit" = j'ai prêté (on me doit).
export const DEBT_DIRECTIONS = ['debt', 'credit'] as const;

export type DebtDirection = (typeof DEBT_DIRECTIONS)[number];

export interface DebtDto {
  id: string;
  userId: string;
  type: DebtDirection;
  counterpartyName: string;
  accountId: string | null;
  principalAmount: string;
  dueDate: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDebtRequest {
  type: DebtDirection;
  counterpartyName: string;
  accountId?: string;
  principalAmount: string;
  dueDate?: string;
  description?: string;
}

export interface UpdateDebtRequest {
  counterpartyName?: string;
  principalAmount?: string;
  // undefined = ne pas modifier ; null = effacer l'échéance existante.
  dueDate?: string | null;
  description?: string;
}

// paidAmount n'est jamais stocké : toujours recalculé à partir des DebtPayment.
export interface DebtProgressDto {
  debtId: string;
  type: DebtDirection;
  counterpartyName: string;
  accountId: string | null;
  principalAmount: string;
  dueDate: string | null;
  paidAmount: string;
  remaining: string;
  // Pourcentage non plafonné (peut dépasser 100 en cas de trop-perçu).
  percentage: number;
  isSettled: boolean;
}

export interface DebtPaymentDto {
  id: string;
  debtId: string;
  amount: string;
  note: string | null;
  paidAt: string;
  createdAt: string;
}

export interface CreateDebtPaymentRequest {
  amount: string;
  note?: string;
  paidAt?: string;
}
