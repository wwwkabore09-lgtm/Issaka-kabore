import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { BudgetsService } from '../budgets/budgets.service';
import { GoalsService } from '../goals/goals.service';
import { DebtsService } from '../debts/debts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: { report: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; delete: jest.Mock } };
  let accountsService: { findAllForUser: jest.Mock };
  let transactionsService: { getUserSummary: jest.Mock };
  let budgetsService: { findAllWithProgress: jest.Mock };
  let goalsService: { findAllForUser: jest.Mock };
  let debtsService: { findAllForUser: jest.Mock };
  let subscriptionsService: { getSummary: jest.Mock };

  const userId = '11111111-1111-1111-1111-111111111111';
  const reportId = '22222222-2222-2222-2222-222222222222';

  const accountA = { id: 'acc-a', name: 'Orange Money', currency: 'XOF', currentBalance: '50000.00' };
  const accountB = { id: 'acc-b', name: 'Wave', currency: 'XOF', currentBalance: '20000.00' };

  beforeEach(() => {
    prisma = {
      report: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    };
    accountsService = { findAllForUser: jest.fn().mockResolvedValue([accountA, accountB]) };
    transactionsService = {
      getUserSummary: jest.fn().mockResolvedValue({
        userId,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30T23:59:59.999Z',
        totalIncome: '100000.00',
        totalExpense: '40000.00',
        netFlow: '60000.00',
      }),
    };
    budgetsService = { findAllWithProgress: jest.fn().mockResolvedValue([]) };
    goalsService = { findAllForUser: jest.fn().mockResolvedValue([]) };
    debtsService = { findAllForUser: jest.fn().mockResolvedValue([]) };
    subscriptionsService = { getSummary: jest.fn().mockResolvedValue({ activeCount: 0, totalMonthlyRecurring: '0.00' }) };

    service = new ReportsService(
      prisma as unknown as PrismaService,
      accountsService as unknown as AccountsService,
      transactionsService as unknown as TransactionsService,
      budgetsService as unknown as BudgetsService,
      goalsService as unknown as GoalsService,
      debtsService as unknown as DebtsService,
      subscriptionsService as unknown as SubscriptionsService,
    );
  });

  describe('generate', () => {
    it('compose le snapshot à partir de tous les domaines et le persiste', async () => {
      prisma.report.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: reportId,
          userId: data.userId,
          title: data.title,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          generatedAt: new Date('2026-06-15T00:00:00.000Z'),
          snapshot: data.snapshot,
        }),
      );

      const result = await service.generate({
        userId,
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30T23:59:59.999Z',
      });

      expect(budgetsService.findAllWithProgress).toHaveBeenCalledTimes(2);
      expect(budgetsService.findAllWithProgress).toHaveBeenCalledWith(
        'acc-a',
        userId,
        '2026-06-01T00:00:00.000Z',
        '2026-06-30T23:59:59.999Z',
      );

      expect(result.snapshot.accounts).toEqual([
        { id: 'acc-a', name: 'Orange Money', currency: 'XOF', currentBalance: '50000.00' },
        { id: 'acc-b', name: 'Wave', currency: 'XOF', currentBalance: '20000.00' },
      ]);
      expect(result.snapshot.cashFlow.totalIncome).toBe('100000.00');
      expect(result.title).toBeDefined();
    });

    it('génère un titre par défaut quand aucun titre n\'est fourni', async () => {
      prisma.report.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: reportId, ...data, generatedAt: new Date() }),
      );

      const result = await service.generate({ userId, from: '2026-06-01T00:00:00.000Z', to: '2026-06-30T00:00:00.000Z' });

      expect(result.title).toContain('2026-06-01');
      expect(result.title).toContain('2026-06-30');
    });

    it('utilise le titre fourni quand présent', async () => {
      prisma.report.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: reportId, ...data, generatedAt: new Date() }),
      );

      const result = await service.generate({
        userId,
        title: 'Mon rapport perso',
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30T00:00:00.000Z',
      });

      expect(result.title).toBe('Mon rapport perso');
    });

    it('rejette une période où from est après to', async () => {
      await expect(
        service.generate({ userId, from: '2026-06-30T00:00:00.000Z', to: '2026-06-01T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.report.create).not.toHaveBeenCalled();
    });

    it("ne compose aucun budget quand l'utilisateur n'a aucun compte", async () => {
      accountsService.findAllForUser.mockResolvedValue([]);
      prisma.report.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: reportId, ...data, generatedAt: new Date() }),
      );

      const result = await service.generate({ userId });

      expect(budgetsService.findAllWithProgress).not.toHaveBeenCalled();
      expect(result.snapshot.accounts).toEqual([]);
      expect(result.snapshot.budgets).toEqual([]);
    });
  });

  describe('findOneForUser', () => {
    it("lève NotFoundException (jamais Forbidden) si le rapport appartient à un autre utilisateur", async () => {
      prisma.report.findUnique.mockResolvedValue({ id: reportId, userId: 'un-autre-user' });

      await expect(service.findOneForUser(reportId, userId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
