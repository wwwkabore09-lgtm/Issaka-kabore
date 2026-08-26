import type {
  AccountBalanceResponse,
  AccountDto,
  BudgetDto,
  BudgetProgressDto,
  CategoryDto,
  CreateAccountRequest,
  CreateBudgetRequest,
  CreateDebtPaymentRequest,
  CreateDebtRequest,
  CreateGoalContributionRequest,
  CreateGoalRequest,
  CreateTransactionRequest,
  DebtPaymentDto,
  DebtProgressDto,
  GoalContributionDto,
  GoalProgressDto,
  TransactionDto,
  TransactionSummaryDto,
  UpdateAccountRequest,
  UpdateBudgetRequest,
  UpdateDebtRequest,
  UpdateGoalRequest,
} from '@finza/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? res.statusText);
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function listAccounts(userId: string) {
  return apiFetch<AccountDto[]>(`/accounts?userId=${encodeURIComponent(userId)}`);
}

export function createAccount(payload: CreateAccountRequest) {
  return apiFetch<AccountDto>('/accounts', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateAccount(id: string, userId: string, payload: UpdateAccountRequest) {
  return apiFetch<AccountDto>(`/accounts/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getAccount(id: string, userId: string) {
  return apiFetch<AccountDto>(`/accounts/${id}?userId=${encodeURIComponent(userId)}`);
}

export function getAccountBalance(id: string, userId: string, asOf?: string) {
  const query = new URLSearchParams({ userId, ...(asOf ? { asOf } : {}) });
  return apiFetch<AccountBalanceResponse>(`/accounts/${id}/balance?${query.toString()}`);
}

export function listCategories(userId: string) {
  return apiFetch<CategoryDto[]>(`/categories?userId=${encodeURIComponent(userId)}`);
}

export function listTransactions(accountId: string, userId: string) {
  const query = new URLSearchParams({ userId, accountId });
  return apiFetch<TransactionDto[]>(`/transactions?${query.toString()}`);
}

export function createTransaction(payload: CreateTransactionRequest) {
  return apiFetch<TransactionDto>('/transactions', { method: 'POST', body: JSON.stringify(payload) });
}

export function getTransactionSummary(accountId: string, userId: string, from: string, to: string) {
  const query = new URLSearchParams({ userId, accountId, from, to });
  return apiFetch<TransactionSummaryDto>(`/transactions/summary?${query.toString()}`);
}

export function listBudgets(accountId: string, userId: string) {
  const query = new URLSearchParams({ userId, accountId });
  return apiFetch<BudgetProgressDto[]>(`/budgets?${query.toString()}`);
}

export function createBudget(payload: CreateBudgetRequest) {
  return apiFetch<BudgetDto>('/budgets', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateBudget(id: string, userId: string, payload: UpdateBudgetRequest) {
  return apiFetch<BudgetDto>(`/budgets/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteBudget(id: string, userId: string) {
  return apiFetch<void>(`/budgets/${id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function listGoals(userId: string) {
  return apiFetch<GoalProgressDto[]>(`/goals?userId=${encodeURIComponent(userId)}`);
}

export function createGoal(payload: CreateGoalRequest) {
  return apiFetch<void>('/goals', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateGoal(id: string, userId: string, payload: UpdateGoalRequest) {
  return apiFetch<void>(`/goals/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteGoal(id: string, userId: string) {
  return apiFetch<void>(`/goals/${id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function listGoalContributions(goalId: string, userId: string) {
  return apiFetch<GoalContributionDto[]>(`/goals/${goalId}/contributions?userId=${encodeURIComponent(userId)}`);
}

export function addGoalContribution(goalId: string, payload: CreateGoalContributionRequest) {
  return apiFetch<GoalContributionDto>(`/goals/${goalId}/contributions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listDebts(userId: string, type?: 'debt' | 'credit') {
  const query = new URLSearchParams({ userId, ...(type ? { type } : {}) });
  return apiFetch<DebtProgressDto[]>(`/debts?${query.toString()}`);
}

export function createDebt(payload: CreateDebtRequest) {
  return apiFetch<void>('/debts', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateDebt(id: string, userId: string, payload: UpdateDebtRequest) {
  return apiFetch<void>(`/debts/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteDebt(id: string, userId: string) {
  return apiFetch<void>(`/debts/${id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export function listDebtPayments(debtId: string, userId: string) {
  return apiFetch<DebtPaymentDto[]>(`/debts/${debtId}/payments?userId=${encodeURIComponent(userId)}`);
}

export function addDebtPayment(debtId: string, payload: CreateDebtPaymentRequest) {
  return apiFetch<DebtPaymentDto>(`/debts/${debtId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
