export const ACCOUNT_TYPES = [
  'orange_money',
  'moov_money',
  'mtn_money',
  'wave',
  'bank_account',
  'bank_card',
  'cash',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_OWNERSHIPS = ['personal', 'professional'] as const;

export type AccountOwnership = (typeof ACCOUNT_OWNERSHIPS)[number];

// Montants sérialisés en string (jamais en number) pour éviter toute perte de précision
// sur les décimales lors du passage par JSON.
export interface AccountDto {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  ownership: AccountOwnership;
  currency: string;
  currentBalance: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  userId: string;
  name: string;
  type: AccountType;
  ownership?: AccountOwnership;
  currency: string;
  openingBalance?: string;
  openingBalanceDate?: string;
}

export interface UpdateAccountRequest {
  name?: string;
  isActive?: boolean;
}

export interface AccountBalanceResponse {
  accountId: string;
  asOf: string;
  balance: string;
}
