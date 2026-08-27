import { Module } from '@nestjs/common';
import { PremiumController } from './premium.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { AdminPremiumController } from './admin-premium.controller';
import { PremiumService } from './premium.service';
import { PaymentService } from './payment.service';
import { AdminPremiumService } from './admin-premium.service';
import { PremiumGuard } from './premium.guard';
import { AdminGuard } from '../auth/admin.guard';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { UnconfiguredPaymentProvider } from './unconfigured-payment.provider';

// Point d'injection unique du prestataire de paiement : aujourd'hui toujours
// UnconfiguredPaymentProvider (aucun prestataire réel connu — voir section 17/20 du cahier
// des charges, jamais d'URL ni d'endpoint fictif). Le jour où le prestataire est fourni, une
// nouvelle classe implémentant PaymentProvider vient se brancher ici — rien d'autre dans
// l'application n'a besoin de changer.
@Module({
  controllers: [PremiumController, PaymentsWebhookController, AdminPremiumController],
  providers: [
    PremiumService,
    PaymentService,
    AdminPremiumService,
    PremiumGuard,
    AdminGuard,
    { provide: PAYMENT_PROVIDER, useClass: UnconfiguredPaymentProvider },
  ],
  exports: [PremiumService, PremiumGuard],
})
export class PremiumModule {}
