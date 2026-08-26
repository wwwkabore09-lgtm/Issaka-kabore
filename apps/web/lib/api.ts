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
  AddFamilyMemberRequest,
  AuthResponseDto,
  AuthTokensDto,
  AuthUserDto,
  CreateFamilyRequest,
  CreateSubscriptionRequest,
  DebtPaymentDto,
  DebtProgressDto,
  FamilyDto,
  GenerateReportRequest,
  GoalContributionDto,
  GoalProgressDto,
  LoginRequest,
  RegisterRequest,
  ReportDto,
  SharedAccountDto,
  SubscriptionDto,
  SubscriptionsSummaryDto,
  TransactionDto,
  TransactionSummaryDto,
  UpdateAccountRequest,
  UpdateBudgetRequest,
  UpdateDebtRequest,
  UpdateGoalRequest,
  UpdateSubscriptionRequest,
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

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export function listAccounts(accessToken: string) {
  return apiFetch<AccountDto[]>('/accounts', { headers: authHeaders(accessToken) });
}

export function createAccount(accessToken: string, payload: CreateAccountRequest) {
  return apiFetch<AccountDto>('/accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function updateAccount(id: string, accessToken: string, payload: UpdateAccountRequest) {
  return apiFetch<AccountDto>(`/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function getAccount(id: string, accessToken: string) {
  return apiFetch<AccountDto>(`/accounts/${id}`, { headers: authHeaders(accessToken) });
}

export function getAccountBalance(id: string, accessToken: string, asOf?: string) {
  const query = new URLSearchParams(asOf ? { asOf } : {});
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<AccountBalanceResponse>(`/accounts/${id}/balance${suffix}`, { headers: authHeaders(accessToken) });
}

export function listCategories(userId: string) {
  return apiFetch<CategoryDto[]>(`/categories?userId=${encodeURIComponent(userId)}`);
}

export function listTransactions(accountId: string, accessToken: string) {
  const query = new URLSearchParams({ accountId });
  return apiFetch<TransactionDto[]>(`/transactions?${query.toString()}`, { headers: authHeaders(accessToken) });
}

export function createTransaction(accessToken: string, payload: CreateTransactionRequest) {
  return apiFetch<TransactionDto>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function getTransactionSummary(accountId: string, accessToken: string, from: string, to: string) {
  const query = new URLSearchParams({ accountId, from, to });
  return apiFetch<TransactionSummaryDto>(`/transactions/summary?${query.toString()}`, {
    headers: authHeaders(accessToken),
  });
}

export function listBudgets(accountId: string, accessToken: string) {
  const query = new URLSearchParams({ accountId });
  return apiFetch<BudgetProgressDto[]>(`/budgets?${query.toString()}`, { headers: authHeaders(accessToken) });
}

export function createBudget(accessToken: string, payload: CreateBudgetRequest) {
  return apiFetch<BudgetDto>('/budgets', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function updateBudget(id: string, accessToken: string, payload: UpdateBudgetRequest) {
  return apiFetch<BudgetDto>(`/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function deleteBudget(id: string, accessToken: string) {
  return apiFetch<void>(`/budgets/${id}`, { method: 'DELETE', headers: authHeaders(accessToken) });
}

export function listGoals(accessToken: string) {
  return apiFetch<GoalProgressDto[]>('/goals', { headers: authHeaders(accessToken) });
}

export function createGoal(accessToken: string, payload: CreateGoalRequest) {
  return apiFetch<void>('/goals', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function updateGoal(id: string, accessToken: string, payload: UpdateGoalRequest) {
  return apiFetch<void>(`/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function deleteGoal(id: string, accessToken: string) {
  return apiFetch<void>(`/goals/${id}`, { method: 'DELETE', headers: authHeaders(accessToken) });
}

export function listGoalContributions(goalId: string, accessToken: string) {
  return apiFetch<GoalContributionDto[]>(`/goals/${goalId}/contributions`, { headers: authHeaders(accessToken) });
}

export function addGoalContribution(goalId: string, accessToken: string, payload: CreateGoalContributionRequest) {
  return apiFetch<GoalContributionDto>(`/goals/${goalId}/contributions`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function listDebts(accessToken: string, type?: 'debt' | 'credit') {
  const query = new URLSearchParams(type ? { type } : {});
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<DebtProgressDto[]>(`/debts${suffix}`, { headers: authHeaders(accessToken) });
}

export function createDebt(accessToken: string, payload: CreateDebtRequest) {
  return apiFetch<void>('/debts', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function updateDebt(id: string, accessToken: string, payload: UpdateDebtRequest) {
  return apiFetch<void>(`/debts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function deleteDebt(id: string, accessToken: string) {
  return apiFetch<void>(`/debts/${id}`, { method: 'DELETE', headers: authHeaders(accessToken) });
}

export function listDebtPayments(debtId: string, accessToken: string) {
  return apiFetch<DebtPaymentDto[]>(`/debts/${debtId}/payments`, { headers: authHeaders(accessToken) });
}

export function addDebtPayment(debtId: string, accessToken: string, payload: CreateDebtPaymentRequest) {
  return apiFetch<DebtPaymentDto>(`/debts/${debtId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function listSubscriptions(accessToken: string, activeOnly?: boolean) {
  const query = new URLSearchParams(activeOnly ? { activeOnly: 'true' } : {});
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<SubscriptionDto[]>(`/subscriptions${suffix}`, { headers: authHeaders(accessToken) });
}

export function getSubscriptionsSummary(accessToken: string) {
  return apiFetch<SubscriptionsSummaryDto>('/subscriptions/summary', { headers: authHeaders(accessToken) });
}

export function createSubscription(accessToken: string, payload: CreateSubscriptionRequest) {
  return apiFetch<void>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function updateSubscription(id: string, accessToken: string, payload: UpdateSubscriptionRequest) {
  return apiFetch<void>(`/subscriptions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function renewSubscription(id: string, accessToken: string) {
  return apiFetch<SubscriptionDto>(`/subscriptions/${id}/renew`, {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export function deleteSubscription(id: string, accessToken: string) {
  return apiFetch<void>(`/subscriptions/${id}`, { method: 'DELETE', headers: authHeaders(accessToken) });
}

export function listReports(accessToken: string) {
  return apiFetch<ReportDto[]>('/reports', { headers: authHeaders(accessToken) });
}

export function generateReport(accessToken: string, payload: GenerateReportRequest) {
  return apiFetch<ReportDto>('/reports/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function deleteReport(id: string, accessToken: string) {
  return apiFetch<void>(`/reports/${id}`, { method: 'DELETE', headers: authHeaders(accessToken) });
}

export function listMyFamilies(accessToken: string) {
  return apiFetch<FamilyDto[]>('/families', { headers: authHeaders(accessToken) });
}

export function createFamily(accessToken: string, payload: CreateFamilyRequest) {
  return apiFetch<FamilyDto>('/families', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function addFamilyMember(familyId: string, accessToken: string, payload: AddFamilyMemberRequest) {
  return apiFetch<FamilyDto>(`/families/${familyId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders(accessToken),
  });
}

export function removeFamilyMember(familyId: string, memberUserId: string, accessToken: string) {
  return apiFetch<void>(`/families/${familyId}/members/${memberUserId}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
}

export function deleteFamily(familyId: string, accessToken: string) {
  return apiFetch<void>(`/families/${familyId}`, { method: 'DELETE', headers: authHeaders(accessToken) });
}

export function listSharedAccounts(familyId: string, accessToken: string) {
  return apiFetch<SharedAccountDto[]>(`/families/${familyId}/shared-accounts`, { headers: authHeaders(accessToken) });
}

export function register(payload: RegisterRequest) {
  return apiFetch<AuthResponseDto>('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export function login(payload: LoginRequest) {
  return apiFetch<AuthResponseDto>('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export function refreshTokens(refreshToken: string) {
  return apiFetch<AuthTokensDto>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
}

export function logout(refreshToken: string) {
  return apiFetch<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
}

export function getMe(accessToken: string) {
  return apiFetch<AuthUserDto>('/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } });
}
