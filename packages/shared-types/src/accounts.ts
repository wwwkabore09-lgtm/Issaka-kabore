// Un "compte" est une source d'argent suivie MANUELLEMENT par l'utilisateur (ex: "Salaire",
// "Commerce", "Argent de poche") — jamais une connexion à Orange Money, Moov Money, MTN
// Mobile Money, Wave ou une banque. category/frequency ne sont que des métadonnées
// descriptives choisies par l'utilisateur lui-même.
export const REVENUE_CATEGORIES = [
  'salaire',
  'activite_professionnelle',
  'commerce',
  'freelance',
  'argent_de_poche',
  'revenu_secondaire',
  'autre',
] as const;

export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number];

export const REVENUE_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'variable'] as const;

export type RevenueFrequency = (typeof REVENUE_FREQUENCIES)[number];

export const ACCOUNT_OWNERSHIPS = ['personal', 'professional'] as const;

export type AccountOwnership = (typeof ACCOUNT_OWNERSHIPS)[number];

// Montants sérialisés en string (jamais en number) pour éviter toute perte de précision
// sur les décimales lors du passage par JSON.
export interface AccountDto {
  id: string;
  userId: string;
  name: string;
  category: RevenueCategory;
  frequency: RevenueFrequency;
  ownership: AccountOwnership;
  currency: string;
  currentBalance: string;
  isActive: boolean;
  // false par défaut : jamais visible aux autres membres de la famille sans action
  // explicite du propriétaire (règle non négociable, cf. domaine Families).
  isSharedWithFamily: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  name: string;
  category: RevenueCategory;
  frequency?: RevenueFrequency;
  ownership?: AccountOwnership;
  currency: string;
  openingBalance?: string;
  openingBalanceDate?: string;
}

export interface UpdateAccountRequest {
  name?: string;
  category?: RevenueCategory;
  frequency?: RevenueFrequency;
  isActive?: boolean;
  isSharedWithFamily?: boolean;
}

export interface AccountBalanceResponse {
  accountId: string;
  asOf: string;
  balance: string;
}
