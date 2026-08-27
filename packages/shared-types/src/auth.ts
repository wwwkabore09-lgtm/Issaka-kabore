import type { RevenueFrequency } from './accounts';

export const FINANCIAL_SITUATIONS = ['stable', 'tendue', 'variable', 'en_amelioration'] as const;

export type FinancialSituation = (typeof FINANCIAL_SITUATIONS)[number];

// Tout est optionnel/nullable : jamais requis à l'inscription, chaque champ reste absent
// tant que l'utilisateur ne l'a pas renseigné dans son profil. Sert uniquement à
// personnaliser l'assistant IA (module `ai`) — jamais utilisé pour se connecter à un
// service financier externe.
export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  // Code pays (ex: "BF") validé contre @finza/config COUNTRIES — jamais inventé si absent.
  country: string | null;
  preferredLanguage: string;
  mainFinancialGoal: string | null;
  incomeFrequency: RevenueFrequency | null;
  financialSituation: FinancialSituation | null;
  // Purement informatif pour l'UI (afficher/masquer le lien Admin) : les routes admin
  // rechargent et vérifient ce rôle depuis la base à chaque requête (voir AdminGuard),
  // jamais sur la seule foi de ce champ.
  isAdmin: boolean;
}

export interface UpdateProfileRequest {
  country?: string | null;
  preferredLanguage?: string;
  mainFinancialGoal?: string | null;
  incomeFrequency?: RevenueFrequency | null;
  financialSituation?: FinancialSituation | null;
}

// refreshToken est un jeton opaque (pas un JWT) : le stocker permet une révocation réelle
// côté serveur (logout, rotation), contrairement à un JWT stateless.
export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponseDto {
  user: AuthUserDto;
  tokens: AuthTokensDto;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}
