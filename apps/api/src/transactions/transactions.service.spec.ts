import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: {
    $transaction: jest.Mock;
    transaction: { create: jest.Mock; findMany: jest.Mock; groupBy: jest.Mock };
    accountBalanceEntry: { create: jest.Mock };
    account: { update: jest.Mock };
    category: { findUnique: jest.Mock };
  };
  let accountsService: { getOwnedAccountOrThrow: jest.Mock };

  const userId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';
  const otherAccountId = '33333333-3333-3333-3333-333333333333';
  const categoryId = '44444444-4444-4444-4444-444444444444';

  const account = { id: accountId, userId, currency: 'XOF' };
  const otherAccount = { id: otherAccountId, userId, currency: 'XOF' };

  const baseTransaction = {
    id: '55555555-5555-5555-5555-555555555555',
    accountId,
    type: 'expense',
    // Transaction.amount est toujours stocké positif ; le sens sur le solde dépend de `type`.
    amount: new Prisma.Decimal('3000.00'),
    categoryId,
    transferToAccountId: null,
    description: null,
    occurredAt: new Date('2026-06-01T00:00:00.000Z'),
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      transaction: { create: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
      accountBalanceEntry: { create: jest.fn() },
      account: { update: jest.fn() },
      category: { findUnique: jest.fn() },
    };

    accountsService = { getOwnedAccountOrThrow: jest.fn() };
    accountsService.getOwnedAccountOrThrow.mockImplementation(async (id: string) =>
      id === accountId ? account : id === otherAccountId ? otherAccount : null,
    );

    service = new TransactionsService(prisma as unknown as PrismaService, accountsService as unknown as AccountsService);
  });

  describe('create — expense', () => {
    it('crée une écriture de grand livre négative et décrémente le solde du compte', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId, userId: null, kind: 'expense' });
      prisma.transaction.create.mockResolvedValue(baseTransaction);

      const result = await service.create(userId, {
        accountId,
        type: 'expense',
        amount: '3000',
        categoryId,
        occurredAt: '2026-06-01T00:00:00.000Z',
      });

      expect(prisma.accountBalanceEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ accountId, source: 'transaction' }),
        }),
      );
      const ledgerAmount = prisma.accountBalanceEntry.create.mock.calls[0][0].data.amount as Prisma.Decimal;
      expect(ledgerAmount.toFixed(2)).toBe('-3000.00');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { currentBalance: { increment: expect.anything() } },
      });

      expect(result.amount).toBe('3000.00');
    });

    it('rejette une catégorie de type income pour une transaction expense', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId, userId: null, kind: 'income' });

      await expect(
        service.create(userId, { accountId, type: 'expense', amount: '1000', categoryId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejette une catégorie appartenant à un autre utilisateur (404, pas 403)", async () => {
      prisma.category.findUnique.mockResolvedValue({ id: categoryId, userId: 'un-autre-user', kind: 'expense' });

      await expect(
        service.create(userId, { accountId, type: 'expense', amount: '1000', categoryId }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejette un montant à zéro ou négatif', async () => {
      await expect(
        service.create(userId, { accountId, type: 'expense', amount: '0', categoryId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create — transfer', () => {
    it('crée deux écritures de grand livre (source -, destination +) sans catégorie', async () => {
      prisma.transaction.create.mockResolvedValue({
        ...baseTransaction,
        type: 'transfer',
        categoryId: null,
        transferToAccountId: otherAccountId,
        amount: new Prisma.Decimal('5000.00'),
      });

      await service.create(userId, {
        accountId,
        type: 'transfer',
        amount: '5000',
        transferToAccountId: otherAccountId,
      });

      expect(prisma.accountBalanceEntry.create).toHaveBeenCalledTimes(2);
      const amounts = prisma.accountBalanceEntry.create.mock.calls.map(
        (call) => (call[0].data.amount as Prisma.Decimal).toFixed(2),
      );
      expect(amounts).toEqual(['-5000.00', '5000.00']);
    });

    it('rejette un transfert entre comptes de devises différentes', async () => {
      accountsService.getOwnedAccountOrThrow.mockImplementation(async (id: string) =>
        id === accountId ? account : { ...otherAccount, currency: 'GHS' },
      );

      await expect(
        service.create(userId, { accountId, type: 'transfer', amount: '1000', transferToAccountId: otherAccountId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejette un transfert avec une categoryId fournie', async () => {
      await expect(
        service.create(userId, {
          accountId,
          type: 'transfer',
          amount: '1000',
          transferToAccountId: otherAccountId,
          categoryId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejette un transfert vers le même compte', async () => {
      await expect(
        service.create(userId, { accountId, type: 'transfer', amount: '1000', transferToAccountId: accountId }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getSummary', () => {
    it('exclut toujours les transferts des totaux revenus/dépenses (règle non négociable)', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { type: 'income', _sum: { amount: new Prisma.Decimal('50000.00') } },
        // Transaction.amount est toujours stocké positif (le sens dépend de `type`).
        { type: 'expense', _sum: { amount: new Prisma.Decimal('12000.00') } },
        // Un très gros transfert : s'il fuitait dans les totaux, le test le détecterait.
        { type: 'transfer', _sum: { amount: new Prisma.Decimal('1000000.00') } },
      ]);

      const summary = await service.getSummary(accountId, userId, '2026-01-01', '2026-12-31');

      expect(summary.totalIncome).toBe('50000.00');
      expect(summary.totalExpense).toBe('12000.00');
      expect(summary.netFlow).toBe('38000.00');
    });

    it("retourne des totaux à 0 quand il n'y a aucune transaction sur la période", async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      const summary = await service.getSummary(accountId, userId, '2026-01-01', '2026-12-31');

      expect(summary.totalIncome).toBe('0.00');
      expect(summary.totalExpense).toBe('0.00');
      expect(summary.netFlow).toBe('0.00');
    });
  });
});
