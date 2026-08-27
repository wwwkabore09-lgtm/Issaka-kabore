import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PremiumService } from './premium.service';
import { UpdateAutoRenewDto } from './dto/update-auto-renew.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { toPaymentHttpException } from './premium-http.util';

@Controller('premium')
@UseGuards(JwtAuthGuard)
export class PremiumController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly premiumService: PremiumService,
  ) {}

  @Get('status')
  getStatus(@CurrentUser() userId: string) {
    return this.premiumService.getSubscription(userId);
  }

  @Post('subscribe')
  async subscribe(@CurrentUser() userId: string) {
    try {
      return await this.paymentService.initiateSubscriptionPayment(userId);
    } catch (error) {
      throw toPaymentHttpException(error);
    }
  }

  @Get('payments')
  listPayments(@CurrentUser() userId: string) {
    return this.paymentService.listPaymentsForUser(userId);
  }

  // "Annuler le renouvellement" (section 1) : ne coupe jamais l'accès en cours, voir
  // PremiumService.deriveStatus — l'utilisateur garde Premium jusqu'à sa date de fin déjà
  // payée, seul le renouvellement automatique s'arrête.
  @Patch('auto-renew')
  setAutoRenew(@CurrentUser() userId: string, @Body() dto: UpdateAutoRenewDto) {
    return this.premiumService.setAutoRenew(userId, dto.autoRenew);
  }
}
