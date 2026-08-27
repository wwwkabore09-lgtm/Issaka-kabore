import { Injectable } from '@nestjs/common';
import { COUNTRIES, CURRENCIES } from '@finza/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { GoalsService } from '../goals/goals.service';
import { DebtsService } from '../debts/debts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

export interface UserProfileSummary {
  fullName: string;
  countryLabel: string | null;
  currencyLabel: string;
  preferredLanguage: string;
  mainFinancialGoal: string | null;
  incomeFrequencyLabel: string | null;
  financialSituationLabel: string | null;
}

export interface FinancialContext {
  profile: UserProfileSummary;
  period: string;
  totalIncome: string;
  totalExpense: string;
  netFlow: string;
  totalSavingsThisMonth: string;
  previousMonthIncome: string;
  previousMonthExpense: string;
  topExpenseCategories: { label: string; amount: string }[];
  goals: { name: string; currentAmount: string; targetAmount: string; percentage: number }[];
  debts: { counterpartyName: string; direction: 'debt' | 'credit'; remaining: string }[];
  activeSubscriptionsCount: number;
  totalMonthlySubscriptions: string;
  hasAnyData: boolean;
}

const INCOME_FREQUENCY_LABELS: Record<string, string> = {
  daily: 'quotidienne',
  weekly: 'hebdomadaire',
  monthly: 'mensuelle',
  quarterly: 'trimestrielle',
  yearly: 'annuelle',
  variable: 'variable',
};

const FINANCIAL_SITUATION_LABELS: Record<string, string> = {
  stable: 'stable',
  tendue: 'tendue',
  variable: 'variable',
  en_amelioration: 'en amélioration',
};

// Compose le contexte envoyé à Gemini en réutilisant les services de chaque domaine — jamais
// en recalculant leurs règles (ex: les transferts restent exclus des dépenses, comme sur le
// Dashboard). N'envoie qu'un RÉSUMÉ agrégé, jamais l'historique brut des transactions : moins
// cher, et rien de plus que ce qui est nécessaire à la question posée (voir section
// "Performance" du cahier des charges IA).
@Injectable()
export class FinancialContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly transactionsService: TransactionsService,
    private readonly goalsService: GoalsService,
    private readonly debtsService: DebtsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async build(userId: string): Promise<FinancialContext> {
    const now = new Date();

    const [user, accounts, dashboard, savings, goals, debts, subscriptions] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.accountsService.findAllForUser(userId),
      this.transactionsService.getDashboardOverview(userId),
      this.goalsService.getSavingsOverview(userId),
      this.goalsService.findAllForUser(userId),
      this.debtsService.findAllForUser(userId),
      this.subscriptionsService.getSummary(userId),
    ]);

    const country = user.country && user.country in COUNTRIES ? COUNTRIES[user.country as keyof typeof COUNTRIES] : null;
    // Devise : celle du pays déclaré si connu, sinon celle du premier compte actif — jamais
    // inventée si ni l'un ni l'autre n'est disponible.
    const currencyCode = country?.currency ?? accounts.find((a) => a.isActive)?.currency ?? accounts[0]?.currency ?? null;
    const currencyLabel = currencyCode ? (CURRENCIES[currencyCode as keyof typeof CURRENCIES]?.symbol ?? currencyCode) : 'devise inconnue';

    const hasAnyData = accounts.length > 0;

    return {
      profile: {
        fullName: user.fullName,
        countryLabel: country?.label ?? null,
        currencyLabel,
        preferredLanguage: user.preferredLanguage,
        mainFinancialGoal: user.mainFinancialGoal,
        incomeFrequencyLabel: user.incomeFrequency ? (INCOME_FREQUENCY_LABELS[user.incomeFrequency] ?? user.incomeFrequency) : null,
        financialSituationLabel: user.financialSituation
          ? (FINANCIAL_SITUATION_LABELS[user.financialSituation] ?? user.financialSituation)
          : null,
      },
      period: now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      totalIncome: dashboard.currentMonth.totalIncome,
      totalExpense: dashboard.currentMonth.totalExpense,
      netFlow: dashboard.currentMonth.netFlow,
      totalSavingsThisMonth: savings.currentMonthTotal,
      previousMonthIncome: dashboard.previousMonth.totalIncome,
      previousMonthExpense: dashboard.previousMonth.totalExpense,
      topExpenseCategories: dashboard.expenseByCategory
        .slice(0, 5)
        .map((c) => ({ label: c.categoryLabel, amount: c.total })),
      goals: goals.map((g) => ({
        name: g.name,
        currentAmount: g.currentAmount,
        targetAmount: g.targetAmount,
        percentage: g.percentage,
      })),
      debts: debts
        .filter((d) => !d.isSettled)
        .map((d) => ({ counterpartyName: d.counterpartyName, direction: d.type, remaining: d.remaining })),
      activeSubscriptionsCount: subscriptions.activeCount,
      totalMonthlySubscriptions: subscriptions.totalMonthlyRecurring,
      hasAnyData,
    };
  }
}
