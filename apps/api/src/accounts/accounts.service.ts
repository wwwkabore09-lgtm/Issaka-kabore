import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccountDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAccountDto): Promise<AccountDto> {
    const openingBalance = new Prisma.Decimal(dto.openingBalance ?? '0');
    const openingBalanceDate = dto.openingBalanceDate ? new Date(dto.openingBalanceDate) : new Date();

    if (openingBalanceDate.getTime() > Date.now()) {
      throw new BadRequestException('openingBalanceDate ne peut pas être dans le futur');
    }

    const account = await this.prisma.$transaction(async (tx) => {
      const created = await tx.account.create({
        data: {
          userId,
          name: dto.name,
          category: dto.category,
          frequency: dto.frequency ?? 'monthly',
          ownership: dto.ownership ?? 'personal',
          currency: dto.currency,
          currentBalance: openingBalance,
        },
      });

      await tx.accountBalanceEntry.create({
        data: {
          accountId: created.id,
          amount: openingBalance,
          source: 'opening',
          effectiveAt: openingBalanceDate,
        },
      });

      return created;
    });

    return this.toDto(account);
  }

  async findAllForUser(userId: string): Promise<AccountDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return accounts.map((account) => this.toDto(account));
  }

  async findOneForUser(id: string, userId: string): Promise<AccountDto> {
    const account = await this.findAccountOrThrow(id, userId);
    return this.toDto(account);
  }

  async update(id: string, userId: string, dto: UpdateAccountDto): Promise<AccountDto> {
    await this.findAccountOrThrow(id, userId);

    if (dto.isSharedWithFamily) {
      // Ne dépend pas de FamiliesService pour éviter un import circulaire entre modules
      // (FamiliesModule importe déjà AccountsModule pour lire les comptes partagés) :
      // une simple vérification d'appartenance suffit ici.
      const membership = await this.prisma.familyMember.findUnique({ where: { userId } });
      if (!membership) {
        throw new BadRequestException("Vous devez appartenir à une famille pour partager un compte");
      }
    }

    const updated = await this.prisma.account.update({
      where: { id },
      data: dto,
    });

    return this.toDto(updated);
  }

  // Reconstitue le solde à une date donnée à partir du grand livre (AccountBalanceEntry),
  // jamais en se fiant uniquement au champ currentBalance.
  async getBalanceAsOf(id: string, userId: string, asOf?: string): Promise<{ accountId: string; asOf: string; balance: string }> {
    await this.findAccountOrThrow(id, userId);

    const asOfDate = asOf ? new Date(asOf) : new Date();

    const result = await this.prisma.accountBalanceEntry.aggregate({
      where: { accountId: id, effectiveAt: { lte: asOfDate } },
      _sum: { amount: true },
    });

    return {
      accountId: id,
      asOf: asOfDate.toISOString(),
      balance: (result._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  // Utilisable par d'autres domaines (ex: Transactions) qui ont besoin de vérifier
  // qu'un compte existe et appartient à l'utilisateur, sans dupliquer cette logique.
  async getOwnedAccountOrThrow(id: string, userId: string) {
    return this.findAccountOrThrow(id, userId);
  }

  // Suppression définitive uniquement si la source n'a encore aucun historique (aucune
  // transaction, aucun budget) : au-delà, on perdrait des écritures du grand livre append-only.
  // Dans ce cas, l'appelant doit désactiver la source (isActive: false) plutôt que la supprimer.
  async remove(id: string, userId: string): Promise<void> {
    await this.findAccountOrThrow(id, userId);

    const [transactionCount, budgetCount] = await Promise.all([
      this.prisma.transaction.count({ where: { OR: [{ accountId: id }, { transferToAccountId: id }] } }),
      this.prisma.budget.count({ where: { accountId: id } }),
    ]);

    if (transactionCount > 0 || budgetCount > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une source avec un historique : désactivez-la plutôt (isActive: false).',
      );
    }

    await this.prisma.account.delete({ where: { id } });
  }

  private async findAccountOrThrow(id: string, userId: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });

    if (!account) {
      throw new NotFoundException('Compte introuvable');
    }

    // 404 (jamais 403) quand le compte appartient à quelqu'un d'autre : ne jamais révéler
    // qu'un compte existe à un appelant qui n'y a pas droit.
    if (account.userId !== userId) {
      throw new NotFoundException('Compte introuvable');
    }

    return account;
  }

  private toDto(account: {
    id: string;
    userId: string;
    name: string;
    category: string;
    frequency: string;
    ownership: string;
    currency: string;
    currentBalance: Prisma.Decimal;
    isActive: boolean;
    isSharedWithFamily: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AccountDto {
    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      category: account.category as AccountDto['category'],
      frequency: account.frequency as AccountDto['frequency'],
      ownership: account.ownership as AccountDto['ownership'],
      currency: account.currency,
      currentBalance: account.currentBalance.toFixed(2),
      isActive: account.isActive,
      isSharedWithFamily: account.isSharedWithFamily,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
