import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BudgetDto, BudgetProgressDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  async create(userId: string, dto: CreateBudgetDto): Promise<BudgetDto> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('amount doit être strictement positif');
    }

    await this.accountsService.getOwnedAccountOrThrow(dto.accountId, userId);

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category || (category.userId !== null && category.userId !== userId)) {
      throw new NotFoundException('Catégorie introuvable');
    }
    if (category.kind !== 'expense') {
      throw new BadRequestException('Un budget ne peut être défini que sur une catégorie de dépense');
    }

    try {
      const budget = await this.prisma.budget.create({
        data: { accountId: dto.accountId, categoryId: dto.categoryId, amount },
      });
      return this.toDto(budget);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un budget existe déjà pour cette catégorie sur ce compte');
      }
      throw error;
    }
  }

  // La progression n'est jamais stockée : recalculée à la demande sur la période demandée
  // (mois courant par défaut) à partir des transactions de type expense.
  async findAllWithProgress(
    accountId: string,
    userId: string,
    from?: string,
    to?: string,
  ): Promise<BudgetProgressDto[]> {
    await this.accountsService.getOwnedAccountOrThrow(accountId, userId);

    const now = new Date();
    const fromDate = from ? new Date(from) : startOfMonth(now);
    const toDate = to ? new Date(to) : endOfMonth(now);

    const budgets = await this.prisma.budget.findMany({
      where: { accountId },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });

    if (budgets.length === 0) return [];

    const spentByCategory = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        accountId,
        type: 'expense',
        occurredAt: { gte: fromDate, lte: toDate },
        categoryId: { in: budgets.map((b) => b.categoryId) },
      },
      _sum: { amount: true },
    });

    const spentMap = new Map(spentByCategory.map((row) => [row.categoryId, row._sum.amount ?? new Prisma.Decimal(0)]));

    return budgets.map((budget) => {
      const spent = spentMap.get(budget.categoryId) ?? new Prisma.Decimal(0);
      const remaining = budget.amount.sub(spent);
      const percentage = budget.amount.gt(0) ? spent.div(budget.amount).mul(100).toNumber() : 0;

      return {
        budgetId: budget.id,
        accountId: budget.accountId,
        categoryId: budget.categoryId,
        categoryLabel: budget.category.label,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        limit: budget.amount.toFixed(2),
        spent: spent.toFixed(2),
        remaining: remaining.toFixed(2),
        percentage: Math.round(percentage * 10) / 10,
      };
    });
  }

  async update(id: string, userId: string, dto: UpdateBudgetDto): Promise<BudgetDto> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('amount doit être strictement positif');
    }

    await this.getOwnedBudgetOrThrow(id, userId);

    const updated = await this.prisma.budget.update({ where: { id }, data: { amount } });
    return this.toDto(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOwnedBudgetOrThrow(id, userId);
    await this.prisma.budget.delete({ where: { id } });
  }

  private async getOwnedBudgetOrThrow(id: string, userId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id } });
    if (!budget) {
      throw new NotFoundException('Budget introuvable');
    }

    // Vérifie que le compte du budget appartient bien à l'utilisateur (404, jamais 403).
    await this.accountsService.getOwnedAccountOrThrow(budget.accountId, userId);

    return budget;
  }

  private toDto(budget: {
    id: string;
    accountId: string;
    categoryId: string;
    amount: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }): BudgetDto {
    return {
      id: budget.id,
      accountId: budget.accountId,
      categoryId: budget.categoryId,
      amount: budget.amount.toFixed(2),
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  }
}
