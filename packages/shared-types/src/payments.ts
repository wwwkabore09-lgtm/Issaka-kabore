// Un seul plan payant existe aujourd'hui : Premium, 2 000 FCFA/mois. Ces constantes sont la
// SEULE source de vérité du prix — le backend les utilise pour fixer le montant attendu de
// chaque paiement (jamais une valeur reçue du frontend), le frontend pour l'affichage.
export const PREMIUM_PLAN = 'premium';
export const PREMIUM_PRICE = '2000.00';
export const PREMIUM_CURRENCY = 'XOF';

export const PAYMENT_STATUSES = ['pending', 'processing', 'successful', 'failed', 'cancelled', 'refunded'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// Dérivé automatiquement par le serveur à partir de endDate/autoRenew — jamais écrit
// directement par le client (voir PremiumService côté backend).
export const PREMIUM_STATUSES = ['pending', 'active', 'expired', 'cancelled'] as const;

export type PremiumStatus = (typeof PREMIUM_STATUSES)[number];

export interface PaymentDto {
  id: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerTransactionId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PremiumSubscriptionDto {
  plan: string;
  price: string;
  currency: string;
  // 'none' = jamais souscrit (aucune ligne en base) — distinct des 4 statuts persistés, qui
  // ne s'appliquent qu'une fois qu'un premier paiement a été initié.
  status: PremiumStatus | 'none';
  isPremium: boolean;
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
}

export interface InitiatePaymentResponseDto {
  payment: PaymentDto;
  // null tant qu'aucun prestataire réel n'est configuré, ou si le prestataire ne renvoie
  // pas d'URL de paiement synchrone — jamais une URL fictive.
  checkoutUrl: string | null;
}

export interface UpdateAutoRenewRequest {
  autoRenew: boolean;
}

export interface AdminPremiumStatsDto {
  premiumUsersCount: number;
  activeSubscriptionsCount: number;
  expiredSubscriptionsCount: number;
  cancelledSubscriptionsCount: number;
  successfulPaymentsCount: number;
  failedPaymentsCount: number;
  pendingPaymentsCount: number;
  totalRevenue: string;
  currency: string;
}

export interface AdminPaymentDto extends PaymentDto {
  userId: string;
  userEmail: string;
  userFullName: string;
}
