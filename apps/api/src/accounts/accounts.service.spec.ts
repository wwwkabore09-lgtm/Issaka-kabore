import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: {
    $transaction: jest.Mock;
    account: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    accountBalanceEntry: {
      create: jest.Mock;
      aggregate: jest.Mock;
    };
    familyMember: {
      findUnique: jest.Mock;
    };
  };

  const userId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';

  const baseAccount = {
    id: accountId,
    userId,
    name: 'Orange Money',
    type: 'orange_money',
    ownership: 'personal',
    currency: 'XOF',
    currentBalance: new Prisma.Decimal('15000.00'),
    isActive: true,
    isSharedWithFamily: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      account: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      accountBalanceEntry: {
        create: jest.fn(),
        aggregate: jest.fn(),
      },
      familyMember: {
        findUnique: jest.fn(),
      },
    };

    service = new AccountsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it("crée le compte et une écriture de grand livre 'opening' pour le solde initial", async () => {
      prisma.account.create.mockResolvedValue(baseAccount);

      const result = await service.create(userId, {
        name: 'Orange Money',
        type: 'orange_money',
        currency: 'XOF',
        openingBalance: '15000',
        openingBalanceDate: '2026-01-01T00:00:00.000Z',
      });

      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            ownership: 'personal',
            currentBalance: expect.any(Prisma.Decimal),
          }),
        }),
      );
      expect(prisma.accountBalanceEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId,
            source: 'opening',
          }),
        }),
      );
      expect(result.currentBalance).toBe('15000.00');
    });

    it('défaut le solde d\'ouverture à 0 quand non fourni', async () => {
      prisma.account.create.mockResolvedValue({
        ...baseAccount,
        currentBalance: new Prisma.Decimal('0'),
      });

      const result = await service.create(userId, {
        name: 'Espèces',
        type: 'cash',
        currency: 'XOF',
      });

      expect(result.currentBalance).toBe('0.00');
    });

    it('rejette une date de solde d\'ouverture dans le futur', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await expect(
        service.create(userId, {
          name: 'Orange Money',
          type: 'orange_money',
          currency: 'XOF',
          openingBalanceDate: future,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.account.create).not.toHaveBeenCalled();
    });
  });

  describe('findOneForUser', () => {
    it("lève NotFoundException si le compte n'existe pas", async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.findOneForUser(accountId, userId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lève NotFoundException (jamais Forbidden) si le compte appartient à un autre utilisateur", async () => {
      prisma.account.findUnique.mockResolvedValue({ ...baseAccount, userId: 'un-autre-user' });

      await expect(service.findOneForUser(accountId, userId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retourne le compte sérialisé quand il appartient à l\'utilisateur', async () => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);

      const result = await service.findOneForUser(accountId, userId);

      expect(result.id).toBe(accountId);
      expect(result.currentBalance).toBe('15000.00');
    });
  });

  describe('update — partage familial', () => {
    beforeEach(() => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
    });

    it("rejette isSharedWithFamily=true quand l'utilisateur n'appartient à aucune famille", async () => {
      prisma.familyMember.findUnique.mockResolvedValue(null);

      await expect(service.update(accountId, userId, { isSharedWithFamily: true })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.account.update).not.toHaveBeenCalled();
    });

    it("autorise isSharedWithFamily=true quand l'utilisateur appartient à une famille", async () => {
      prisma.familyMember.findUnique.mockResolvedValue({ userId, familyId: 'fam-1' });
      prisma.account.update.mockResolvedValue({ ...baseAccount, isSharedWithFamily: true });

      const result = await service.update(accountId, userId, { isSharedWithFamily: true });

      expect(result.isSharedWithFamily).toBe(true);
    });

    it('ne vérifie pas l\'appartenance familiale pour les autres mises à jour', async () => {
      prisma.account.update.mockResolvedValue({ ...baseAccount, name: 'Renommé' });

      await service.update(accountId, userId, { name: 'Renommé' });

      expect(prisma.familyMember.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getBalanceAsOf', () => {
    beforeEach(() => {
      prisma.account.findUnique.mockResolvedValue(baseAccount);
    });

    it('reconstitue le solde à partir de la somme des écritures du grand livre, pas de currentBalance', async () => {
      prisma.accountBalanceEntry.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('15000.00') },
      });

      const result = await service.getBalanceAsOf(accountId, userId, '2026-06-01T00:00:00.000Z');

      expect(prisma.accountBalanceEntry.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId, effectiveAt: { lte: new Date('2026-06-01T00:00:00.000Z') } },
        }),
      );
      expect(result.balance).toBe('15000.00');
    });

    it("retourne '0.00' quand aucune écriture n'existe encore à la date demandée", async () => {
      prisma.accountBalanceEntry.aggregate.mockResolvedValue({ _sum: { amount: null } });

      const result = await service.getBalanceAsOf(accountId, userId, '2025-01-01T00:00:00.000Z');

      expect(result.balance).toBe('0.00');
    });
  });
});
