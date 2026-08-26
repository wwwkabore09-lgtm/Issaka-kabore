import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { GoalsModule } from '../goals/goals.module';
import { DebtsModule } from '../debts/debts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [AccountsModule, TransactionsModule, BudgetsModule, GoalsModule, DebtsModule, SubscriptionsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
