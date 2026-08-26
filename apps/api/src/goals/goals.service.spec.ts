import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';

describe('GoalsService', () => {
  let service: GoalsService;
  let prisma: {
    goal: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    goalContribution: { create: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock; groupBy: jest.Mock };
  };
  let accountsService: { getOwnedAccountOrThrow: jest.Mock };

  const userId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';
  const goalId = '33333333-3333-3333-3333-333333333333';

  const goal = {
    id: goalId,
    userId,
    accountId: null,
    name: 'Achat moto',
    targetAmount: new Prisma.Decimal('500000.00'),
    targetDate: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      goal: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      goalContribution: { create: jest.fn(), findMany: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
    };
    accountsService = { getOwnedAccountOrThrow: jest.fn().mockResolvedValue({ id: accountId, userId }) };

    service = new GoalsService(prisma as unknown as PrismaService, accountsService as unknown as AccountsService);
  });

  describe('create', () => {
    it('crée un objectif sans compte lié', async () => {
      prisma.goal.create.mockResolvedValue(goal);

      const result = await service.create(userId, { name: 'Achat moto', targetAmount: '500000' });

      expect(accountsService.getOwnedAccountOrThrow).not.toHaveBeenCalled();
      expect(result.targetAmount).toBe('500000.00');
    });

    it('vérifie la propriété du compte quand accountId est fourni', async () => {
      prisma.goal.create.mockResolvedValue({ ...goal, accountId });

      await service.create(userId, { accountId, name: 'Épargne Wave', targetAmount: '100000' });

      expect(accountsService.getOwnedAccountOrThrow).toHaveBeenCalledWith(accountId, userId);
    });

    it('rejette un montant cible à zéro', async () => {
      await expect(service.create(userId, { name: 'Test', targetAmount: '0' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejette une targetDate dans le passé', async () => {
      await expect(
        service.create(userId, { name: 'Test', targetAmount: '1000', targetDate: '2020-01-01T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAllForUser', () => {
    it('calcule currentAmount/remaining/percentage à partir des contributions', async () => {
      prisma.goal.findMany.mockResolvedValue([goal]);
      prisma.goalContribution.groupBy.mockResolvedValue([
        { goalId, _sum: { amount: new Prisma.Decimal('150000.00') } },
      ]);

      const [progress] = await service.findAllForUser(userId);

      expect(progress.currentAmount).toBe('150000.00');
      expect(progress.remaining).toBe('350000.00');
      expect(progress.percentage).toBe(30);
      expect(progress.isAchieved).toBe(false);
    });

    it("marque l'objectif comme atteint quand currentAmount >= targetAmount", async () => {
      prisma.goal.findMany.mockResolvedValue([goal]);
      prisma.goalContribution.groupBy.mockResolvedValue([
        { goalId, _sum: { amount: new Prisma.Decimal('600000.00') } },
      ]);

      const [progress] = await service.findAllForUser(userId);

      expect(progress.isAchieved).toBe(true);
      expect(progress.remaining).toBe('-100000.00');
      expect(progress.percentage).toBe(120);
    });

    it("ne fait aucun appel de calcul quand l'utilisateur n'a aucun objectif", async () => {
      prisma.goal.findMany.mockResolvedValue([]);

      const result = await service.findAllForUser(userId);

      expect(result).toEqual([]);
      expect(prisma.goalContribution.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('addContribution', () => {
    it('ajoute une contribution positive', async () => {
      prisma.goal.findUnique.mockResolvedValue(goal);
      prisma.goalContribution.create.mockResolvedValue({
        id: '44444444-4444-4444-4444-444444444444',
        goalId,
        amount: new Prisma.Decimal('20000.00'),
        note: null,
        contributedAt: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      });

      const result = await service.addContribution(goalId, userId, { amount: '20000' });

      expect(result.amount).toBe('20000.00');
    });

    it('rejette une contribution à zéro', async () => {
      prisma.goal.findUnique.mockResolvedValue(goal);

      await expect(service.addContribution(goalId, userId, { amount: '0' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("lève NotFoundException (jamais Forbidden) si l'objectif appartient à un autre utilisateur", async () => {
      prisma.goal.findUnique.mockResolvedValue({ ...goal, userId: 'un-autre-user' });

      await expect(service.addContribution(goalId, userId, { amount: '1000' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.goalContribution.create).not.toHaveBeenCalled();
    });
  });
});
