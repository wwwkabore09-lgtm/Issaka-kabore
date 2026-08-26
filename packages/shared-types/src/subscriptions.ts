export const BILLING_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;

export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];

export interface SubscriptionDto {
  id: string;
  userId: string;
  accountId: string | null;
  categoryId: string | null;
  name: string;
  amount: string;
  billingFrequency: BillingFrequency;
  nextBillingDate: string;
  isActive: boolean;
  // Coût ramené à un mois, pour comparer des abonnements de fréquences différentes.
  // Toujours calculé à la demande, jamais stocké.
  monthlyEquivalent: string;
  // Négatif si l'échéance est déjà passée.
  daysUntilNextBilling: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionRequest {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  userId: string;
  accountId?: string;
  categoryId?: string;
  name: string;
  amount: string;
  billingFrequency: BillingFrequency;
  nextBillingDate: string;
}

export interface UpdateSubscriptionRequest {
  name?: string;
  amount?: string;
  billingFrequency?: BillingFrequency;
  nextBillingDate?: string;
  categoryId?: string;
  isActive?: boolean;
}

export interface SubscriptionsSummaryDto {
  activeCount: number;
  totalMonthlyRecurring: string;
}
