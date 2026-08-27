import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AdminPaymentDto, AdminPremiumStatsDto } from '@finza/shared-types';
import { PREMIUM_CURRENCY } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';

// Lecture seule, jamais de mutation ici : modifier une transaction financière n'est pas
// exposé à l'admin (section "Administration" du cahier des charges — pas de modification
// manuelle sans protection/journalisation, non implémentée pour l'instant).
@Injectable()
export class AdminPremiumService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminPremiumStatsDto> {
    const [subscriptionCounts, paymentCounts, revenueAgg] = await Promise.all([
      this.prisma.premiumSubscription.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.payment.aggregate({ where: { status: 'successful' }, _sum: { amount: true } }),
    ]);

    const subCount = (status: string) => subscriptionCounts.find((s) => s.status === status)?._count._all ?? 0;
    const payCount = (status: string) => paymentCounts.find((p) => p.status === status)?._count._all ?? 0;

    return {
      premiumUsersCount: subCount('active'),
      activeSubscriptionsCount: subCount('active'),
      expiredSubscriptionsCount: subCount('expired'),
      cancelledSubscriptionsCount: subCount('cancelled'),
      successfulPaymentsCount: payCount('successful'),
      failedPaymentsCount: payCount('failed'),
      pendingPaymentsCount: payCount('pending') + payCount('processing'),
      totalRevenue: (revenueAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      currency: PREMIUM_CURRENCY,
    };
  }

  async listTransactions(limit = 50): Promise<AdminPaymentDto[]> {
    const payments = await this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { email: true, fullName: true } } },
    });

    return payments.map((p) => ({
      id: p.id,
      userId: p.userId,
      userEmail: p.user.email,
      userFullName: p.user.fullName,
      amount: p.amount.toFixed(2),
      currency: p.currency,
      status: p.status as AdminPaymentDto['status'],
      provider: p.provider,
      providerTransactionId: p.providerTransactionId,
      createdAt: p.createdAt.toISOString(),
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    }));
  }
}
