import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let prisma: {
    budget: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    category: { findUnique: jest.Mock };
    transaction: { groupBy: jest.Mock };
  };
  let accountsService: { getOwnedAccountOrThrow: jest.Mock };

  const userId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';
  const categoryId = '33333333-3333-3333-3333-333333333333';
  const budgetId = '44444444-4444-4444-4444-444444444444';

  const budget = {
    id: budgetId,
    accountId,
    categoryId,
    amount: new Prisma.Decimal('50000.00'),
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    category: { id: categoryId, label: 'Alimentation', kind: 'expense' },
  };

  beforeEach(() => {
    prisma = {
      budget: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      category: { findUnique: jest.fn() },
      transaction: { groupBy: jest.fn() },
    };
    accountsService = { getOwnedAccountOrThrow: jest.fn().mockResolvedValue({ id: accountId, userId }) };

    service = new BudgetsService(prisma as unknown as PrismaService, accountsService as unknown as AccountsService);
  });

  describe('create', () => {
    it('crée un budget sur une catégorie de dépense', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId, userId: null, kind: 'expense' });
      prisma.budget.create.mockResolvedValue(budget);

      const result = await service.create({ userId, accountId, categoryId, amount: '50000' });

      expect(result.amount).toBe('50000.00');
    });

    it('rejette une catégorie de type income', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId, userId: null, kind: 'income' });

      await expect(service.create({ userId, accountId, categoryId, amount: '50000' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejette un montant à zéro', async () => {
      await expect(service.create({ userId, accountId, categoryId, amount: '0' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejette un second budget pour la même catégorie sur le même compte (409)', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId, userId: null, kind: 'expense' });
      prisma.budget.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      await expect(service.create({ userId, accountId, categoryId, amount: '50000' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('findAllWithProgress', () => {
    it('calcule spent/remaining/percentage à partir des dépenses de la période', async () => {
      prisma.budget.findMany.mockResolvedValue([budget]);
      prisma.transaction.groupBy.mockResolvedValue([{ categoryId, _sum: { amount: new Prisma.Decimal('32500.00') } }]);

      const [progress] = await service.findAllWithProgress(accountId, userId, '2026-06-01', '2026-06-30');

      expect(progress.limit).toBe('50000.00');
      expect(progress.spent).toBe('32500.00');
      expect(progress.remaining).toBe('17500.00');
      expect(progress.percentage).toBe(65);
      expect(progress.categoryLabel).toBe('Alimentation');
    });

    it("retourne spent à 0 quand aucune dépense n'a été faite sur la catégorie", async () => {
      prisma.budget.findMany.mockResolvedValue([budget]);
      prisma.transaction.groupBy.mockResolvedValue([]);

      const [progress] = await service.findAllWithProgress(accountId, userId, '2026-06-01', '2026-06-30');

      expect(progress.spent).toBe('0.00');
      expect(progress.remaining).toBe('50000.00');
      expect(progress.percentage).toBe(0);
    });

    it('calcule un pourcentage supérieur à 100 en cas de dépassement du budget', async () => {
      prisma.budget.findMany.mockResolvedValue([budget]);
      prisma.transaction.groupBy.mockResolvedValue([{ categoryId, _sum: { amount: new Prisma.Decimal('75000.00') } }]);

      const [progress] = await service.findAllWithProgress(accountId, userId, '2026-06-01', '2026-06-30');

      expect(progress.remaining).toBe('-25000.00');
      expect(progress.percentage).toBe(150);
    });

    it("ne fait aucun appel de calcul de dépenses quand il n'y a aucun budget", async () => {
      prisma.budget.findMany.mockResolvedValue([]);

      const result = await service.findAllWithProgress(accountId, userId);

      expect(result).toEqual([]);
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('update / remove', () => {
    it("lève NotFoundException si le budget n'existe pas", async () => {
      prisma.budget.findUnique.mockResolvedValue(null);

      await expect(service.update(budgetId, userId, { amount: '1000' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lève NotFoundException (jamais Forbidden) si le compte du budget appartient à un autre utilisateur", async () => {
      prisma.budget.findUnique.mockResolvedValue(budget);
      accountsService.getOwnedAccountOrThrow.mockRejectedValue(new NotFoundException('Compte introuvable'));

      await expect(service.remove(budgetId, userId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.budget.delete).not.toHaveBeenCalled();
    });

    it('met à jour le montant du budget', async () => {
      prisma.budget.findUnique.mockResolvedValue(budget);
      prisma.budget.update.mockResolvedValue({ ...budget, amount: new Prisma.Decimal('60000.00') });

      const result = await service.update(budgetId, userId, { amount: '60000' });

      expect(result.amount).toBe('60000.00');
    });
  });
});
