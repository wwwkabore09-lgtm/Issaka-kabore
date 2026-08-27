import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GoalsModule } from './goals/goals.module';
import { DebtsModule } from './debts/debts.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ReportsModule } from './reports/reports.module';
import { FamiliesModule } from './families/families.module';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { PremiumModule } from './premium/premium.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Limite globale par défaut (100 req/min/IP) — resserrée sur /auth/login et
    // /auth/register via @Throttle pour limiter le bruteforce de mot de passe et la
    // création massive de comptes.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
    GoalsModule,
    DebtsModule,
    SubscriptionsModule,
    ReportsModule,
    FamiliesModule,
    PremiumModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
