import type { PaymentStatus } from '@finza/shared-types';

export interface PaymentCustomer {
  userId: string;
  email: string;
  fullName: string;
}

export interface CreatePaymentParams {
  // Notre identifiant interne (Payment.id), à transmettre au prestataire comme référence
  // marchande — permet de retrouver le paiement à la réception du webhook sans dépendre
  // uniquement de son propre identifiant.
  paymentId: string;
  amount: string;
  currency: string;
  description: string;
  customer: PaymentCustomer;
}

export interface CreatePaymentResult {
  // null si le prestataire n'assigne pas d'identifiant de façon synchrone.
  providerTransactionId: string | null;
  // null tant qu'aucun prestataire réel n'est branché, ou si non fourni de façon
  // synchrone — jamais une URL fictive.
  checkoutUrl: string | null;
  status: Extract<PaymentStatus, 'pending' | 'processing'>;
  raw?: unknown;
}

export interface VerifiedPaymentEvent {
  // Notre paymentId, si le prestataire l'a échoé dans son événement (référence marchande) —
  // sert à retrouver la ligne Payment même sans providerTransactionId déjà connu.
  paymentId: string | null;
  providerTransactionId: string;
  status: PaymentStatus;
  amount: string;
  currency: string;
  raw: unknown;
}

// Port que toute implémentation de prestataire réel doit respecter — le reste de
// l'application (PaymentService, le controller webhook) ne dépend jamais d'un SDK ou d'une
// API de prestataire directement. Changer de prestataire = écrire une nouvelle classe qui
// implémente cette interface et la brancher dans premium.module.ts, rien d'autre à modifier.
export interface PaymentProvider {
  readonly name: string;

  isConfigured(): boolean;

  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;

  // Vérifie l'authenticité de la requête webhook (signature/HMAC selon le prestataire)
  // AVANT de considérer son contenu comme fiable. Ne jamais lire un webhook non vérifié.
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string>): boolean;

  // À n'appeler qu'après verifyWebhookSignature() === true.
  parseWebhookEvent(rawBody: Buffer, headers: Record<string, string>): VerifiedPaymentEvent;

  // Optionnel : vérification active côté serveur (polling), si le prestataire l'expose —
  // permet de confirmer un paiement même si son webhook n'arrive jamais.
  fetchPaymentStatus?(providerTransactionId: string): Promise<VerifiedPaymentEvent>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
