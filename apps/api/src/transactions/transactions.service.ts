import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TransactionDto, TransactionSummaryDto, TransactionUserSummaryDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  async create(dto: CreateTransactionDto): Promise<TransactionDto> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('amount doit être strictement positif');
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (occurredAt.getTime() > Date.now()) {
      throw new BadRequestException('occurredAt ne peut pas être dans le futur');
    }

    const sourceAccount = await this.accountsService.getOwnedAccountOrThrow(dto.accountId, dto.userId);

    if (dto.type === 'transfer') {
      if (dto.categoryId) {
        throw new BadRequestException("categoryId ne s'applique pas à un transfert");
      }
      if (!dto.transferToAccountId) {
        throw new BadRequestException('transferToAccountId est requis pour un transfert');
      }
      if (dto.transferToAccountId === dto.accountId) {
        throw new BadRequestException('Impossible de transférer un compte vers lui-même');
      }

      const destinationAccount = await this.accountsService.getOwnedAccountOrThrow(
        dto.transferToAccountId,
        dto.userId,
      );

      if (destinationAccount.currency !== sourceAccount.currency) {
        throw new BadRequestException('Le transfert entre devises différentes n\'est pas supporté');
      }

      const transaction = await this.prisma.$transaction(async (tx) => {
        const created = await tx.transaction.create({
          data: {
            accountId: dto.accountId,
            type: 'transfer',
            amount,
            transferToAccountId: dto.transferToAccountId,
            description: dto.description,
            occurredAt,
          },
        });

        await this.appendLedgerEntry(tx, dto.accountId, amount.neg(), occurredAt);
        await this.appendLedgerEntry(tx, dto.transferToAccountId as string, amount, occurredAt);

        return created;
      });

      return this.toDto(transaction);
    }

    // income / expense
    if (dto.transferToAccountId) {
      throw new BadRequestException("transferToAccountId ne s'applique pas à ce type de transaction");
    }
    if (!dto.categoryId) {
      throw new BadRequestException('categoryId est requis pour une transaction de type income ou expense');
    }

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category || (category.userId !== null && category.userId !== dto.userId)) {
      throw new NotFoundException('Catégorie introuvable');
    }
    if (category.kind !== dto.type) {
      throw new BadRequestException(
        `La catégorie sélectionnée est de type "${category.kind}", incompatible avec une transaction de type "${dto.type}"`,
      );
    }

    const signedAmount = dto.type === 'income' ? amount : amount.neg();

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          accountId: dto.accountId,
          type: dto.type,
          amount,
          categoryId: dto.categoryId,
          description: dto.description,
          occurredAt,
        },
      });

      await this.appendLedgerEntry(tx, dto.accountId, signedAmount, occurredAt);

      return created;
    });

    return this.toDto(transaction);
  }

  async findAllForAccount(accountId: string, userId: string): Promise<TransactionDto[]> {
    await this.accountsService.getOwnedAccountOrThrow(accountId, userId);

    const transactions = await this.prisma.transaction.findMany({
      where: { accountId },
      orderBy: { occurredAt: 'desc' },
    });

    return transactions.map((t) => this.toDto(t));
  }

  // Total revenus/dépenses sur une période. Les transferts ne sont JAMAIS comptés ici :
  // ce n'est ni un revenu, ni une dépense, seulement un mouvement entre comptes.
  async getSummary(accountId: string, userId: string, from: string, to: string): Promise<TransactionSummaryDto> {
    await this.accountsService.getOwnedAccountOrThrow(accountId, userId);

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { accountId, occurredAt: { gte: fromDate, lte: toDate } },
      _sum: { amount: true },
    });

    const totalIncome = grouped.find((g) => g.type === 'income')?._sum.amount ?? new Prisma.Decimal(0);
    const totalExpense = grouped.find((g) => g.type === 'expense')?._sum.amount ?? new Prisma.Decimal(0);
    // grouped peut contenir une entrée type: 'transfer' — volontairement ignorée ci-dessus.

    return {
      accountId,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netFlow: totalIncome.sub(totalExpense).toFixed(2),
    };
  }

  // Même agrégat que getSummary, mais tous comptes confondus pour l'utilisateur
  // (utilisé par le domaine Reports pour construire un instantané global).
  async getUserSummary(userId: string, from: string, to: string): Promise<TransactionUserSummaryDto> {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { account: { userId }, occurredAt: { gte: fromDate, lte: toDate } },
      _sum: { amount: true },
    });

    const totalIncome = grouped.find((g) => g.type === 'income')?._sum.amount ?? new Prisma.Decimal(0);
    const totalExpense = grouped.find((g) => g.type === 'expense')?._sum.amount ?? new Prisma.Decimal(0);

    return {
      userId,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netFlow: totalIncome.sub(totalExpense).toFixed(2),
    };
  }

  private async appendLedgerEntry(
    tx: Prisma.TransactionClient,
    accountId: string,
    signedAmount: Prisma.Decimal,
    effectiveAt: Date,
  ) {
    await tx.accountBalanceEntry.create({
      data: { accountId, amount: signedAmount, source: 'transaction', effectiveAt },
    });

    await tx.account.update({
      where: { id: accountId },
      data: { currentBalance: { increment: signedAmount } },
    });
  }

  private toDto(transaction: {
    id: string;
    accountId: string;
    type: string;
    amount: Prisma.Decimal;
    categoryId: string | null;
    transferToAccountId: string | null;
    description: string | null;
    occurredAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): TransactionDto {
    return {
      id: transaction.id,
      accountId: transaction.accountId,
      type: transaction.type as TransactionDto['type'],
      amount: transaction.amount.toFixed(2),
      categoryId: transaction.categoryId,
      transferToAccountId: transaction.transferToAccountId,
      description: transaction.description,
      occurredAt: transaction.occurredAt.toISOString(),
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }
}
