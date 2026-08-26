import type { AccountDto } from './accounts';
import type { BudgetProgressDto } from './budgets';
import type { DebtProgressDto } from './debts';
import type { GoalProgressDto } from './goals';
import type { SubscriptionsSummaryDto } from './subscriptions';
import type { TransactionUserSummaryDto } from './transactions';

// Instantané figé au moment de la génération : ces chiffres ne bougent plus, même si les
// comptes/transactions sous-jacents changent ensuite. C'est la différence avec les autres
// domaines (toujours recalculés à la demande).
export interface ReportSnapshot {
  accounts: Pick<AccountDto, 'id' | 'name' | 'currency' | 'currentBalance'>[];
  cashFlow: TransactionUserSummaryDto;
  budgets: BudgetProgressDto[];
  goals: GoalProgressDto[];
  debts: DebtProgressDto[];
  subscriptions: SubscriptionsSummaryDto;
}

export interface ReportDto {
  id: string;
  userId: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  snapshot: ReportSnapshot;
}

export interface GenerateReportRequest {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  userId: string;
  title?: string;
  // Par défaut : le mois courant.
  from?: string;
  to?: string;
}
