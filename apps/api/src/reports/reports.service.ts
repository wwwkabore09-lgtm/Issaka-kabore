import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ReportDto, ReportSnapshot } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { BudgetsService } from '../budgets/budgets.service';
import { GoalsService } from '../goals/goals.service';
import { DebtsService } from '../debts/debts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { GenerateReportDto } from './dto/generate-report.dto';

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly transactionsService: TransactionsService,
    private readonly budgetsService: BudgetsService,
    private readonly goalsService: GoalsService,
    private readonly debtsService: DebtsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  // Construit un instantané en composant les domaines déjà en place, plutôt qu'en
  // recalculant leur logique : chaque chiffre vient de la même règle de calcul que sur sa
  // propre page (ex: les transferts restent exclus du cash-flow, via TransactionsService).
  async generate(userId: string, dto: GenerateReportDto): Promise<ReportDto> {
    const now = new Date();
    const periodStart = dto.from ? new Date(dto.from) : startOfMonth(now);
    const periodEnd = dto.to ? new Date(dto.to) : endOfMonth(now);

    if (periodStart.getTime() > periodEnd.getTime()) {
      throw new BadRequestException('from doit être antérieur ou égal à to');
    }

    const accounts = await this.accountsService.findAllForUser(userId);

    const [cashFlow, budgetsByAccount, goals, debts, subscriptions] = await Promise.all([
      this.transactionsService.getUserSummary(userId, periodStart.toISOString(), periodEnd.toISOString()),
      Promise.all(
        accounts.map((account) =>
          this.budgetsService.findAllWithProgress(account.id, userId, periodStart.toISOString(), periodEnd.toISOString()),
        ),
      ),
      this.goalsService.findAllForUser(userId),
      this.debtsService.findAllForUser(userId),
      this.subscriptionsService.getSummary(userId),
    ]);

    const snapshot: ReportSnapshot = {
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency, currentBalance: a.currentBalance })),
      cashFlow,
      budgets: budgetsByAccount.flat(),
      goals,
      debts,
      subscriptions,
    };

    const title = dto.title ?? `Rapport du ${this.formatDate(periodStart)} au ${this.formatDate(periodEnd)}`;

    const report = await this.prisma.report.create({
      data: {
        userId,
        title,
        periodStart,
        periodEnd,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    return this.toDto(report);
  }

  async findAllForUser(userId: string): Promise<ReportDto[]> {
    const reports = await this.prisma.report.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
    });

    return reports.map((r) => this.toDto(r));
  }

  async findOneForUser(id: string, userId: string): Promise<ReportDto> {
    const report = await this.getOwnedReportOrThrow(id, userId);
    return this.toDto(report);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOwnedReportOrThrow(id, userId);
    await this.prisma.report.delete({ where: { id } });
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private async getOwnedReportOrThrow(id: string, userId: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });

    if (!report || report.userId !== userId) {
      // 404 (jamais 403) : ne jamais révéler qu'un rapport existe à qui n'y a pas droit.
      throw new NotFoundException('Rapport introuvable');
    }

    return report;
  }

  private toDto(report: {
    id: string;
    userId: string;
    title: string;
    periodStart: Date;
    periodEnd: Date;
    generatedAt: Date;
    snapshot: Prisma.JsonValue;
  }): ReportDto {
    return {
      id: report.id,
      userId: report.userId,
      title: report.title,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      generatedAt: report.generatedAt.toISOString(),
      snapshot: report.snapshot as unknown as ReportSnapshot,
    };
  }
}
