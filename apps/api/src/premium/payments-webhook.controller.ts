import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from './payment.service';
import { toPaymentHttpException } from './premium-http.util';

// Route publique (pas de JwtAuthGuard) — appelée par le prestataire de paiement, jamais par
// le frontend de l'utilisateur. Sécurisée par la vérification de signature dans
// PaymentService.handleWebhookEvent, pas par une authentification JWT. Ne jamais faire
// confiance à des données reçues ici sans cette vérification passée en premier.
@Controller('payments')
export class PaymentsWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>) {
    if (!req.rawBody) {
      throw new BadRequestException('Corps de requête manquant.');
    }
    try {
      await this.paymentService.handleWebhookEvent(req.rawBody, req.headers as Record<string, string>);
      return { received: true };
    } catch (error) {
      throw toPaymentHttpException(error);
    }
  }
}
