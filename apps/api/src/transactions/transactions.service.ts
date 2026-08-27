import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  DashboardOverviewDto,
  RevenueOverviewDto,
  TransactionDto,
  TransactionSummaryDto,
  TransactionUserSummaryDto,
} from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionDto> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('amount doit être strictement positif');
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (occurredAt.getTime() > Date.now()) {
      throw new BadRequestException('occurredAt ne peut pas être dans le futur');
    }

    const sourceAccount = await this.accountsService.getOwnedAccountOrThrow(dto.accountId, userId);

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
        userId,
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
    if (!category || (category.userId !== null && category.userId !== userId)) {
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

  // categoryId/description/amount sont modifiables directement sur la ligne (comme pour
  // Budget.amount) ; seul le montant signé qui affecte le solde passe par une écriture de
  // grand livre APPENTéE (jamais réécrite), datée d'aujourd'hui — le solde "à une date passée"
  // reste donc exact même après une correction faite plus tard.
  async update(id: string, userId: string, dto: UpdateTransactionDto): Promise<TransactionDto> {
    const transaction = await this.getOwnedTransactionOrThrow(id, userId);

    if (transaction.type === 'transfer' && (dto.amount !== undefined || dto.categoryId !== undefined)) {
      throw new BadRequestException(
        "Un transfert ne peut pas être modifié (montant/catégorie) : supprimez-le et recréez-le si nécessaire.",
      );
    }

    const data: Prisma.TransactionUpdateInput = {};

    if (dto.categoryId !== undefined) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category || (category.userId !== null && category.userId !== userId)) {
        throw new NotFoundException('Catégorie introuvable');
      }
      if (category.kind !== transaction.type) {
        throw new BadRequestException(
          `La catégorie sélectionnée est de type "${category.kind}", incompatible avec une transaction de type "${transaction.type}"`,
        );
      }
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    if (dto.amount === undefined) {
      const updated = await this.prisma.transaction.update({ where: { id }, data });
      return this.toDto(updated);
    }

    const newAmount = new Prisma.Decimal(dto.amount);
    if (newAmount.lte(0)) {
      throw new BadRequestException('amount doit être strictement positif');
    }
    const oldSigned = transaction.type === 'income' ? transaction.amount : transaction.amount.neg();
    const newSigned = transaction.type === 'income' ? newAmount : newAmount.neg();
    const delta = newSigned.sub(oldSigned);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedTransaction = await tx.transaction.update({ where: { id }, data: { ...data, amount: newAmount } });
      if (!delta.isZero()) {
        await this.appendLedgerEntry(tx, transaction.accountId, delta, new Date());
      }
      return updatedTransaction;
    });

    return this.toDto(updated);
  }

  // Une transaction n'est jamais "annulée en place" : l'écriture de grand livre d'origine
  // reste dans l'historique, une écriture compensatoire est ajoutée (jamais de réécriture),
  // puis la transaction elle-même est supprimée (comme pour les autres domaines : budgets,
  // objectifs, dettes, abonnements ont tous un vrai DELETE).
  async remove(id: string, userId: string): Promise<void> {
    const transaction = await this.getOwnedTransactionOrThrow(id, userId);

    await this.prisma.$transaction(async (tx) => {
      if (transaction.type === 'transfer') {
        await this.appendLedgerEntry(tx, transaction.accountId, transaction.amount, new Date());
        await this.appendLedgerEntry(
          tx,
          transaction.transferToAccountId as string,
          transaction.amount.neg(),
          new Date(),
        );
      } else {
        const reverseSigned = transaction.type === 'income' ? transaction.amount.neg() : transaction.amount;
        await this.appendLedgerEntry(tx, transaction.accountId, reverseSigned, new Date());
      }
      await tx.transaction.delete({ where: { id } });
    });
  }

  private async getOwnedTransactionOrThrow(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({ where: { id } });
    if (!transaction) {
      throw new NotFoundException('Transaction introuvable');
    }
    // 404 (jamais 403) : vérifie que le compte source de la transaction appartient à l'utilisateur.
    await this.accountsService.getOwnedAccountOrThrow(transaction.accountId, userId);
    return transaction;
  }

  // accountId absent = vue centralisée "Transactions" sur tous les comptes de l'utilisateur ;
  // fourni = liste scopée à un compte (page de détail d'un compte). Mêmes filtres dans les
  // deux cas (type, catégorie, période, recherche texte sur la description).
  async findAll(userId: string, query: ListTransactionsQueryDto): Promise<TransactionDto[]> {
    if (query.accountId) {
      await this.accountsService.getOwnedAccountOrThrow(query.accountId, userId);
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        ...(query.accountId ? { accountId: query.accountId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.from || query.to
          ? {
              occurredAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
        ...(query.q ? { description: { contains: query.q, mode: 'insensitive' } } : {}),
      },
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

  // Vue d'ensemble des revenus saisis manuellement par l'utilisateur, tous comptes confondus.
  // Compte à la fois les transactions de type income ET le solde d'ouverture d'une source
  // (le "Montant" saisi à la création d'un revenu manuel) : les deux sont des revenus
  // déclarés par l'utilisateur lui-même, jamais une donnée récupérée d'un tiers.
  async getRevenueOverview(userId: string): Promise<RevenueOverviewDto> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    const daysSinceMonday = (startOfToday.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const epoch = new Date(0);

    const [today, thisWeek, thisMonth, previousMonth, thisYear, allTime, earliestTx, earliestOpening] =
      await Promise.all([
        this.sumRevenue(userId, startOfToday, now),
        this.sumRevenue(userId, startOfWeek, now),
        this.sumRevenue(userId, startOfMonth, now),
        this.sumRevenue(userId, startOfPreviousMonth, startOfMonth),
        this.sumRevenue(userId, startOfYear, now),
        this.sumRevenue(userId, epoch, now),
        this.prisma.transaction.findFirst({
          where: { type: 'income', account: { userId } },
          orderBy: { occurredAt: 'asc' },
        }),
        this.prisma.accountBalanceEntry.findFirst({
          where: { source: 'opening', amount: { gt: 0 }, account: { userId } },
          orderBy: { effectiveAt: 'asc' },
        }),
      ]);

    const earliestDate = [earliestTx?.occurredAt, earliestOpening?.effectiveAt]
      .filter((d): d is Date => d !== undefined)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const monthsSinceFirstEntry = earliestDate
      ? Math.max(
          1,
          (now.getFullYear() - earliestDate.getFullYear()) * 12 + (now.getMonth() - earliestDate.getMonth()) + 1,
        )
      : 1;
    const averageMonthly = allTime.div(monthsSinceFirstEntry);

    const evolutionVsPreviousMonth = previousMonth.gt(0)
      ? thisMonth.sub(previousMonth).div(previousMonth).mul(100).toFixed(1)
      : null;

    return {
      userId,
      today: today.toFixed(2),
      thisWeek: thisWeek.toFixed(2),
      thisMonth: thisMonth.toFixed(2),
      thisYear: thisYear.toFixed(2),
      allTime: allTime.toFixed(2),
      averageMonthly: averageMonthly.toFixed(2),
      evolutionVsPreviousMonth,
      generatedAt: now.toISOString(),
    };
  }

  // Tout ce dont le tableau de bord a besoin en un seul appel, toujours calculé depuis ce que
  // l'utilisateur a lui-même saisi. Le "revenu" compte transactions ET soldes d'ouverture,
  // exactement comme getRevenueOverview (voir sumRevenue) — sinon un revenu déclaré à la
  // création d'une source de revenus disparaîtrait des chiffres du tableau de bord alors
  // qu'il apparaît bien dans les statistiques de la page Comptes.
  async getDashboardOverview(userId: string, months = 6): Promise<DashboardOverviewDto> {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [currentIncome, currentExpense, previousIncome, previousExpense, monthlySeries, expenseGroups] =
      await Promise.all([
        this.sumRevenue(userId, startOfCurrentMonth, now),
        this.sumExpense(userId, startOfCurrentMonth, now),
        this.sumRevenue(userId, startOfPreviousMonth, startOfCurrentMonth),
        this.sumExpense(userId, startOfPreviousMonth, startOfCurrentMonth),
        Promise.all(
          Array.from({ length: months }, (_, i) => months - 1 - i).map(async (offset) => {
            const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
            const [totalIncome, totalExpense] = await Promise.all([
              this.sumRevenue(userId, start, end),
              this.sumExpense(userId, start, end),
            ]);
            return {
              month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
              totalIncome: totalIncome.toFixed(2),
              totalExpense: totalExpense.toFixed(2),
            };
          }),
        ),
        this.prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
            account: { userId },
            type: 'expense',
            occurredAt: { gte: startOfCurrentMonth, lte: now },
            categoryId: { not: null },
          },
          _sum: { amount: true },
        }),
      ]);

    const categoryIds = expenseGroups
      .map((row) => row.categoryId)
      .filter((id): id is string => id !== null);
    const categories = categoryIds.length
      ? await this.prisma.category.findMany({ where: { id: { in: categoryIds } } })
      : [];
    const labelById = new Map(categories.map((c) => [c.id, c.label]));

    return {
      currentMonth: {
        totalIncome: currentIncome.toFixed(2),
        totalExpense: currentExpense.toFixed(2),
        netFlow: currentIncome.sub(currentExpense).toFixed(2),
      },
      previousMonth: { totalIncome: previousIncome.toFixed(2), totalExpense: previousExpense.toFixed(2) },
      monthlySeries,
      expenseByCategory: expenseGroups
        .filter((row): row is typeof row & { categoryId: string } => row.categoryId !== null)
        .map((row) => ({
          categoryId: row.categoryId,
          categoryLabel: labelById.get(row.categoryId) ?? '—',
          total: (row._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        }))
        .sort((a, b) => Number(b.total) - Number(a.total)),
    };
  }

  private async sumExpense(userId: string, from: Date, to: Date): Promise<Prisma.Decimal> {
    const result = await this.prisma.transaction.aggregate({
      where: { type: 'expense', account: { userId }, occurredAt: { gte: from, lt: to } },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  private async sumRevenue(userId: string, from: Date, to: Date): Promise<Prisma.Decimal> {
    const [incomeTx, openingEntries] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { type: 'income', account: { userId }, occurredAt: { gte: from, lt: to } },
        _sum: { amount: true },
      }),
      this.prisma.accountBalanceEntry.aggregate({
        where: { source: 'opening', amount: { gt: 0 }, effectiveAt: { gte: from, lt: to }, account: { userId } },
        _sum: { amount: true },
      }),
    ]);
    const income = incomeTx._sum.amount ?? new Prisma.Decimal(0);
    const opening = openingEntries._sum.amount ?? new Prisma.Decimal(0);
    return income.add(opening);
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
