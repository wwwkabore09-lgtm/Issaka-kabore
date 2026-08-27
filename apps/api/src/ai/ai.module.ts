import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { GoalsModule } from '../goals/goals.module';
import { DebtsModule } from '../debts/debts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PremiumModule } from '../premium/premium.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';
import { FinancialContextService } from './financial-context.service';

@Module({
  imports: [AccountsModule, TransactionsModule, GoalsModule, DebtsModule, SubscriptionsModule, PremiumModule],
  controllers: [AiController],
  providers: [AiService, GeminiService, FinancialContextService],
})
export class AiModule {}
