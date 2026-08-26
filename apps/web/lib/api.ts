import type { AccountBalanceResponse, AccountDto, CreateAccountRequest, UpdateAccountRequest } from '@finza/shared-types';

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

export function getAccountBalance(id: string, userId: string, asOf?: string) {
  const query = new URLSearchParams({ userId, ...(asOf ? { asOf } : {}) });
  return apiFetch<AccountBalanceResponse>(`/accounts/${id}/balance?${query.toString()}`);
}
