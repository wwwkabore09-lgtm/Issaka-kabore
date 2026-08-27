import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { GoalContributionDto, GoalDto, GoalProgressDto, SavingsOverviewDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CreateContributionDto } from './dto/create-contribution.dto';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  async create(userId: string, dto: CreateGoalDto): Promise<GoalDto> {
    const targetAmount = new Prisma.Decimal(dto.targetAmount);
    if (targetAmount.lte(0)) {
      throw new BadRequestException('targetAmount doit être strictement positif');
    }

    const targetDate = this.parseFutureDateOrThrow(dto.targetDate, 'targetDate');

    if (dto.accountId) {
      await this.accountsService.getOwnedAccountOrThrow(dto.accountId, userId);
    }

    const goal = await this.prisma.goal.create({
      data: {
        userId,
        accountId: dto.accountId,
        name: dto.name,
        targetAmount,
        targetDate,
      },
    });

    return this.toDto(goal);
  }

  async findAllForUser(userId: string): Promise<GoalProgressDto[]> {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (goals.length === 0) return [];

    const sums = await this.prisma.goalContribution.groupBy({
      by: ['goalId'],
      where: { goalId: { in: goals.map((g) => g.id) } },
      _sum: { amount: true },
    });
    const sumMap = new Map(sums.map((s) => [s.goalId, s._sum.amount ?? new Prisma.Decimal(0)]));

    return goals.map((goal) => this.toProgressDto(goal, sumMap.get(goal.id) ?? new Prisma.Decimal(0)));
  }

  async findOneForUser(id: string, userId: string): Promise<GoalProgressDto> {
    const goal = await this.getOwnedGoalOrThrow(id, userId);

    const result = await this.prisma.goalContribution.aggregate({
      where: { goalId: id },
      _sum: { amount: true },
    });

    return this.toProgressDto(goal, result._sum.amount ?? new Prisma.Decimal(0));
  }

  async listContributions(goalId: string, userId: string): Promise<GoalContributionDto[]> {
    await this.getOwnedGoalOrThrow(goalId, userId);

    const contributions = await this.prisma.goalContribution.findMany({
      where: { goalId },
      orderBy: { contributedAt: 'desc' },
    });

    return contributions.map((c) => ({
      id: c.id,
      goalId: c.goalId,
      amount: c.amount.toFixed(2),
      note: c.note,
      contributedAt: c.contributedAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async addContribution(goalId: string, userId: string, dto: CreateContributionDto): Promise<GoalContributionDto> {
    await this.getOwnedGoalOrThrow(goalId, userId);

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('amount doit être strictement positif');
    }

    const contributedAt = dto.contributedAt ? new Date(dto.contributedAt) : new Date();
    if (contributedAt.getTime() > Date.now()) {
      throw new BadRequestException('contributedAt ne peut pas être dans le futur');
    }

    const contribution = await this.prisma.goalContribution.create({
      data: { goalId, amount, note: dto.note, contributedAt },
    });

    return {
      id: contribution.id,
      goalId: contribution.goalId,
      amount: contribution.amount.toFixed(2),
      note: contribution.note,
      contributedAt: contribution.contributedAt.toISOString(),
      createdAt: contribution.createdAt.toISOString(),
    };
  }

  // "Épargne" du tableau de bord : total des contributions saisies par l'utilisateur ce
  // mois-ci, tous objectifs confondus, plus une série mensuelle pour le graphique d'évolution.
  async getSavingsOverview(userId: string, months = 6): Promise<SavingsOverviewDto> {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [currentMonthAgg, monthlySeries] = await Promise.all([
      this.prisma.goalContribution.aggregate({
        where: { goal: { userId }, contributedAt: { gte: startOfCurrentMonth, lte: now } },
        _sum: { amount: true },
      }),
      Promise.all(
        Array.from({ length: months }, (_, i) => months - 1 - i).map(async (offset) => {
          const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
          const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
          const agg = await this.prisma.goalContribution.aggregate({
            where: { goal: { userId }, contributedAt: { gte: start, lt: end } },
            _sum: { amount: true },
          });
          return {
            month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
            total: (agg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
          };
        }),
      ),
    ]);

    return {
      currentMonthTotal: (currentMonthAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      monthlySeries,
    };
  }

  async update(id: string, userId: string, dto: UpdateGoalDto): Promise<GoalDto> {
    await this.getOwnedGoalOrThrow(id, userId);

    const data: Prisma.GoalUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.targetAmount !== undefined) {
      const targetAmount = new Prisma.Decimal(dto.targetAmount);
      if (targetAmount.lte(0)) {
        throw new BadRequestException('targetAmount doit être strictement positif');
      }
      data.targetAmount = targetAmount;
    }
    if (dto.targetDate !== undefined) {
      data.targetDate = this.parseFutureDateOrThrow(dto.targetDate, 'targetDate');
    }

    const updated = await this.prisma.goal.update({ where: { id }, data });
    return this.toDto(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOwnedGoalOrThrow(id, userId);
    await this.prisma.goal.delete({ where: { id } });
  }

  private parseFutureDateOrThrow(value: string | undefined, field: string): Date | undefined {
    if (!value) return undefined;

    const date = new Date(value);
    if (date.getTime() <= Date.now()) {
      throw new BadRequestException(`${field} doit être dans le futur`);
    }
    return date;
  }

  private async getOwnedGoalOrThrow(id: string, userId: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });

    if (!goal || goal.userId !== userId) {
      // 404 (jamais 403) : ne jamais révéler qu'un objectif existe à qui n'y a pas droit.
      throw new NotFoundException('Objectif introuvable');
    }

    return goal;
  }

  private toDto(goal: {
    id: string;
    userId: string;
    accountId: string | null;
    name: string;
    targetAmount: Prisma.Decimal;
    targetDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): GoalDto {
    return {
      id: goal.id,
      userId: goal.userId,
      accountId: goal.accountId,
      name: goal.name,
      targetAmount: goal.targetAmount.toFixed(2),
      targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
    };
  }

  private toProgressDto(
    goal: {
      id: string;
      accountId: string | null;
      name: string;
      targetAmount: Prisma.Decimal;
      targetDate: Date | null;
    },
    currentAmount: Prisma.Decimal,
  ): GoalProgressDto {
    const remaining = goal.targetAmount.sub(currentAmount);
    const percentage = goal.targetAmount.gt(0) ? currentAmount.div(goal.targetAmount).mul(100).toNumber() : 0;

    return {
      goalId: goal.id,
      name: goal.name,
      accountId: goal.accountId,
      targetAmount: goal.targetAmount.toFixed(2),
      targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
      currentAmount: currentAmount.toFixed(2),
      remaining: remaining.toFixed(2),
      percentage: Math.round(percentage * 10) / 10,
      isAchieved: currentAmount.gte(goal.targetAmount),
    };
  }
}
