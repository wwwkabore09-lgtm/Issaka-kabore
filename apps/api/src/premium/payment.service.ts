import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaymentDto, InitiatePaymentResponseDto } from '@finza/shared-types';
import { PREMIUM_CURRENCY, PREMIUM_PRICE } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider, type VerifiedPaymentEvent } from './payment-provider.interface';
import { PremiumService } from './premium.service';
import { InvalidWebhookSignatureError, PaymentAmountMismatchError, PaymentNotConfiguredError, PaymentProviderError, UnknownPaymentError } from './payment.errors';

// États d'où un paiement ne doit plus jamais bouger : reçoit-on le même événement webhook
// deux fois (le prestataire ne garantit pas une livraison unique), le second est un no-op.
const TERMINAL_STATUSES = new Set(['successful', 'failed', 'cancelled', 'refunded']);

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly premiumService: PremiumService,
  ) {}

  async initiateSubscriptionPayment(userId: string): Promise<InitiatePaymentResponseDto> {
    if (!this.provider.isConfigured()) {
      throw new PaymentNotConfiguredError();
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // La ligne d'abonnement existe dès la première tentative (statut "pending"), pour que
    // GET /premium/status reflète immédiatement "en attente" — mais son statut/ses dates ne
    // sont jamais modifiés tant que le paiement n'a pas réellement abouti.
    await this.premiumService.ensurePendingSubscription(userId);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount: new Prisma.Decimal(PREMIUM_PRICE),
        currency: PREMIUM_CURRENCY,
        status: 'pending',
        provider: this.provider.name,
      },
    });

    try {
      const result = await this.provider.createPayment({
        paymentId: payment.id,
        amount: PREMIUM_PRICE,
        currency: PREMIUM_CURRENCY,
        description: 'Abonnement Finza Premium — 1 mois',
        customer: { userId: user.id, email: user.email, fullName: user.fullName },
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerTransactionId: result.providerTransactionId,
          status: result.status,
          metadata: (result.raw as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      return { payment: this.toDto(updated), checkoutUrl: result.checkoutUrl };
    } catch (error) {
      this.logger.error(`Échec de création du paiement ${payment.id} chez ${this.provider.name}: ${errorMessage(error)}`);
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed', completedAt: new Date() } });
      throw error instanceof PaymentProviderError ? error : new PaymentProviderError();
    }
  }

  async listPaymentsForUser(userId: string): Promise<PaymentDto[]> {
    const payments = await this.prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return payments.map((p) => this.toDto(p));
  }

  async handleWebhookEvent(rawBody: Buffer, headers: Record<string, string>): Promise<void> {
    if (!this.provider.isConfigured()) {
      throw new PaymentNotConfiguredError();
    }
    if (!this.provider.verifyWebhookSignature(rawBody, headers)) {
      throw new InvalidWebhookSignatureError();
    }
    const event = this.provider.parseWebhookEvent(rawBody, headers);
    await this.applyPaymentUpdate(event);
  }

  private async applyPaymentUpdate(event: VerifiedPaymentEvent): Promise<void> {
    const payment = event.paymentId
      ? await this.prisma.payment.findUnique({ where: { id: event.paymentId } })
      : await this.prisma.payment.findUnique({ where: { providerTransactionId: event.providerTransactionId } });

    if (!payment) {
      this.logger.warn(`Webhook pour une transaction inconnue : paymentId=${event.paymentId} providerTransactionId=${event.providerTransactionId}`);
      throw new UnknownPaymentError();
    }

    // Idempotence (section "double paiement") : un paiement déjà résolu ne doit jamais être
    // retraité, quel que soit le nombre de fois où le prestataire livre le même événement.
    if (TERMINAL_STATUSES.has(payment.status)) {
      this.logger.log(`Webhook ignoré (paiement ${payment.id} déjà "${payment.status}")`);
      return;
    }

    if (event.status === 'successful') {
      const amountMatches = new Prisma.Decimal(event.amount).eq(payment.amount) && event.currency === payment.currency;
      if (!amountMatches) {
        this.logger.error(
          `Montant incohérent pour le paiement ${payment.id} : attendu ${payment.amount.toFixed(2)} ${payment.currency}, ` +
            `reçu ${event.amount} ${event.currency} — paiement marqué en échec, abonnement jamais activé.`,
        );
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            providerTransactionId: event.providerTransactionId,
            metadata: (event.raw as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            completedAt: new Date(),
          },
        });
        throw new PaymentAmountMismatchError();
      }
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: event.status,
        providerTransactionId: event.providerTransactionId,
        metadata: (event.raw as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        completedAt: TERMINAL_STATUSES.has(event.status) ? new Date() : null,
      },
    });

    if (event.status === 'successful') {
      await this.premiumService.activateOrRenew(payment.userId);
    } else if (event.status === 'refunded') {
      await this.premiumService.revokeForRefund(payment.userId);
    }
  }

  private toDto(payment: {
    id: string;
    amount: Prisma.Decimal;
    currency: string;
    status: string;
    provider: string;
    providerTransactionId: string | null;
    createdAt: Date;
    completedAt: Date | null;
  }): PaymentDto {
    return {
      id: payment.id,
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      status: payment.status as PaymentDto['status'],
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId,
      createdAt: payment.createdAt.toISOString(),
      completedAt: payment.completedAt ? payment.completedAt.toISOString() : null,
    };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
