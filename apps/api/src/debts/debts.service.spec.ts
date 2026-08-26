import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DebtsService } from './debts.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';

describe('DebtsService', () => {
  let service: DebtsService;
  let prisma: {
    debt: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    debtPayment: { create: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock; groupBy: jest.Mock };
  };
  let accountsService: { getOwnedAccountOrThrow: jest.Mock };

  const userId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';
  const debtId = '33333333-3333-3333-3333-333333333333';

  const debt = {
    id: debtId,
    userId,
    type: 'debt',
    counterpartyName: 'Boubacar',
    accountId: null,
    principalAmount: new Prisma.Decimal('100000.00'),
    dueDate: null,
    description: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      debt: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      debtPayment: { create: jest.fn(), findMany: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn() },
    };
    accountsService = { getOwnedAccountOrThrow: jest.fn().mockResolvedValue({ id: accountId, userId }) };

    service = new DebtsService(prisma as unknown as PrismaService, accountsService as unknown as AccountsService);
  });

  describe('create', () => {
    it('crée une dette (type debt) sans compte lié', async () => {
      prisma.debt.create.mockResolvedValue(debt);

      const result = await service.create({ userId, type: 'debt', counterpartyName: 'Boubacar', principalAmount: '100000' });

      expect(accountsService.getOwnedAccountOrThrow).not.toHaveBeenCalled();
      expect(result.type).toBe('debt');
      expect(result.principalAmount).toBe('100000.00');
    });

    it('vérifie la propriété du compte quand accountId est fourni', async () => {
      prisma.debt.create.mockResolvedValue({ ...debt, accountId, type: 'credit' });

      await service.create({
        userId,
        type: 'credit',
        counterpartyName: 'Awa',
        accountId,
        principalAmount: '50000',
      });

      expect(accountsService.getOwnedAccountOrThrow).toHaveBeenCalledWith(accountId, userId);
    });

    it('rejette un principalAmount à zéro', async () => {
      await expect(
        service.create({ userId, type: 'debt', counterpartyName: 'Test', principalAmount: '0' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findAllForUser', () => {
    it('calcule paidAmount/remaining/percentage à partir des paiements', async () => {
      prisma.debt.findMany.mockResolvedValue([debt]);
      prisma.debtPayment.groupBy.mockResolvedValue([{ debtId, _sum: { amount: new Prisma.Decimal('40000.00') } }]);

      const [progress] = await service.findAllForUser(userId);

      expect(progress.paidAmount).toBe('40000.00');
      expect(progress.remaining).toBe('60000.00');
      expect(progress.percentage).toBe(40);
      expect(progress.isSettled).toBe(false);
    });

    it('marque la dette comme soldée quand paidAmount >= principalAmount', async () => {
      prisma.debt.findMany.mockResolvedValue([debt]);
      prisma.debtPayment.groupBy.mockResolvedValue([{ debtId, _sum: { amount: new Prisma.Decimal('120000.00') } }]);

      const [progress] = await service.findAllForUser(userId);

      expect(progress.isSettled).toBe(true);
      expect(progress.remaining).toBe('-20000.00');
      expect(progress.percentage).toBe(120);
    });

    it('filtre par direction (type) quand demandé', async () => {
      prisma.debt.findMany.mockResolvedValue([]);

      await service.findAllForUser(userId, 'credit');

      expect(prisma.debt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, type: 'credit' } }),
      );
    });
  });

  describe('addPayment', () => {
    it('ajoute un paiement positif', async () => {
      prisma.debt.findUnique.mockResolvedValue(debt);
      prisma.debtPayment.create.mockResolvedValue({
        id: '44444444-4444-4444-4444-444444444444',
        debtId,
        amount: new Prisma.Decimal('25000.00'),
        note: null,
        paidAt: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      });

      const result = await service.addPayment(debtId, { userId, amount: '25000' });

      expect(result.amount).toBe('25000.00');
    });

    it('rejette un paiement à zéro', async () => {
      prisma.debt.findUnique.mockResolvedValue(debt);

      await expect(service.addPayment(debtId, { userId, amount: '0' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("lève NotFoundException (jamais Forbidden) si la dette appartient à un autre utilisateur", async () => {
      prisma.debt.findUnique.mockResolvedValue({ ...debt, userId: 'un-autre-user' });

      await expect(service.addPayment(debtId, { userId, amount: '1000' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.debtPayment.create).not.toHaveBeenCalled();
    });
  });
});
