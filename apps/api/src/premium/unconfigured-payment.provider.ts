import { Injectable, Logger } from '@nestjs/common';
import type { CreatePaymentResult, PaymentProvider, VerifiedPaymentEvent } from './payment-provider.interface';

// Branché par défaut tant qu'aucun prestataire réel n'est configuré (PAYMENT_API_KEY absente)
// — refuse tout plutôt que de simuler un paiement ou une passerelle. Jamais d'URL ni
// d'endpoint fictif : voir premium.module.ts pour l'endroit où un vrai prestataire viendra
// se brancher derrière PaymentProvider.
@Injectable()
export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly name = 'unconfigured';
  private readonly logger = new Logger(UnconfiguredPaymentProvider.name);

  isConfigured(): boolean {
    return false;
  }

  async createPayment(): Promise<CreatePaymentResult> {
    throw new Error(
      'UnconfiguredPaymentProvider.createPayment ne doit jamais être appelé : PaymentService vérifie isConfigured() avant.',
    );
  }

  verifyWebhookSignature(): boolean {
    this.logger.warn("Webhook de paiement reçu alors qu'aucun prestataire n'est configuré — rejeté.");
    return false;
  }

  parseWebhookEvent(): VerifiedPaymentEvent {
    throw new Error(
      'UnconfiguredPaymentProvider.parseWebhookEvent ne doit jamais être appelé : verifyWebhookSignature() est toujours false.',
    );
  }
}
