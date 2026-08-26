import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: {
    subscription: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    category: { findUnique: jest.Mock };
  };
  let accountsService: { getOwnedAccountOrThrow: jest.Mock };

  const userId = '11111111-1111-1111-1111-111111111111';
  const subscriptionId = '22222222-2222-2222-2222-222222222222';

  function makeSubscription(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: subscriptionId,
      userId,
      accountId: null,
      categoryId: null,
      name: 'Netflix',
      amount: new Prisma.Decimal('6000.00'),
      billingFrequency: 'monthly',
      nextBillingDate: new Date('2026-07-01T00:00:00.000Z'),
      isActive: true,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      subscription: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      category: { findUnique: jest.fn() },
    };
    accountsService = { getOwnedAccountOrThrow: jest.fn().mockResolvedValue({ id: 'acc', userId }) };

    service = new SubscriptionsService(prisma as unknown as PrismaService, accountsService as unknown as AccountsService);
  });

  describe('monthlyEquivalent (via toDto)', () => {
    it('monthly reste inchangé', async () => {
      prisma.subscription.findUnique.mockResolvedValue(makeSubscription({ billingFrequency: 'monthly', amount: new Prisma.Decimal('6000') }));

      const result = await service.findOneForUser(subscriptionId, userId);

      expect(result.monthlyEquivalent).toBe('6000.00');
    });

    it('yearly est divisé par 12', async () => {
      prisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ billingFrequency: 'yearly', amount: new Prisma.Decimal('120000') }),
      );

      const result = await service.findOneForUser(subscriptionId, userId);

      expect(result.monthlyEquivalent).toBe('10000.00');
    });

    it('quarterly est divisé par 3', async () => {
      prisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ billingFrequency: 'quarterly', amount: new Prisma.Decimal('9000') }),
      );

      const result = await service.findOneForUser(subscriptionId, userId);

      expect(result.monthlyEquivalent).toBe('3000.00');
    });

    it('weekly est multiplié par 52/12', async () => {
      prisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ billingFrequency: 'weekly', amount: new Prisma.Decimal('1000') }),
      );

      const result = await service.findOneForUser(subscriptionId, userId);

      // 1000 * 52 / 12 = 4333.33...
      expect(result.monthlyEquivalent).toBe('4333.33');
    });
  });

  describe('getSummary', () => {
    it('additionne les équivalents mensuels des abonnements actifs uniquement', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        makeSubscription({ id: 'a', billingFrequency: 'monthly', amount: new Prisma.Decimal('6000'), isActive: true }),
        makeSubscription({ id: 'b', billingFrequency: 'yearly', amount: new Prisma.Decimal('120000'), isActive: true }),
      ]);

      const summary = await service.getSummary(userId);

      expect(prisma.subscription.findMany).toHaveBeenCalledWith({ where: { userId, isActive: true } });
      expect(summary.activeCount).toBe(2);
      // 6000 (monthly) + 10000 (120000/12) = 16000
      expect(summary.totalMonthlyRecurring).toBe('16000.00');
    });

    it('retourne un total à 0 sans abonnement actif', async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      const summary = await service.getSummary(userId);

      expect(summary.activeCount).toBe(0);
      expect(summary.totalMonthlyRecurring).toBe('0.00');
    });
  });

  describe('renew', () => {
    it('avance nextBillingDate d\'un mois pour un abonnement monthly', async () => {
      prisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ billingFrequency: 'monthly', nextBillingDate: new Date('2026-06-15T00:00:00.000Z') }),
      );
      prisma.subscription.update.mockImplementation(({ data }) =>
        Promise.resolve(makeSubscription({ nextBillingDate: data.nextBillingDate })),
      );

      const result = await service.renew(subscriptionId, userId);

      expect(new Date(result.nextBillingDate).toISOString()).toBe('2026-07-15T00:00:00.000Z');
    });

    it("avance nextBillingDate d'un an pour un abonnement yearly", async () => {
      prisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ billingFrequency: 'yearly', nextBillingDate: new Date('2026-06-15T00:00:00.000Z') }),
      );
      prisma.subscription.update.mockImplementation(({ data }) =>
        Promise.resolve(makeSubscription({ nextBillingDate: data.nextBillingDate })),
      );

      const result = await service.renew(subscriptionId, userId);

      expect(new Date(result.nextBillingDate).toISOString()).toBe('2027-06-15T00:00:00.000Z');
    });

    it("avance nextBillingDate de 7 jours pour un abonnement weekly", async () => {
      prisma.subscription.findUnique.mockResolvedValue(
        makeSubscription({ billingFrequency: 'weekly', nextBillingDate: new Date('2026-06-15T00:00:00.000Z') }),
      );
      prisma.subscription.update.mockImplementation(({ data }) =>
        Promise.resolve(makeSubscription({ nextBillingDate: data.nextBillingDate })),
      );

      const result = await service.renew(subscriptionId, userId);

      expect(new Date(result.nextBillingDate).toISOString()).toBe('2026-06-22T00:00:00.000Z');
    });

    it("lève NotFoundException (jamais Forbidden) si l'abonnement appartient à un autre utilisateur", async () => {
      prisma.subscription.findUnique.mockResolvedValue(makeSubscription({ userId: 'un-autre-user' }));

      await expect(service.renew(subscriptionId, userId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('rejette un montant à zéro', async () => {
      await expect(
        service.create({ userId, name: 'Test', amount: '0', billingFrequency: 'monthly', nextBillingDate: '2026-07-01T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejette une catégorie de type income', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat', userId: null, kind: 'income' });

      await expect(
        service.create({
          userId,
          name: 'Test',
          amount: '1000',
          billingFrequency: 'monthly',
          nextBillingDate: '2026-07-01T00:00:00.000Z',
          categoryId: 'cat',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
