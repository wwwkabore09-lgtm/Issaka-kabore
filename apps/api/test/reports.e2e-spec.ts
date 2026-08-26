import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerTestUser } from './utils/auth';

describe('ReportsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let accessToken: string;
  let accountId: string;
  let expenseCategoryId: string;
  let incomeCategoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const user = await registerTestUser(app, { email: `reports-e2e-${Date.now()}@finza.test`, fullName: 'Test User' });
    userId = user.userId;
    accessToken = user.accessToken;

    const [expenseCategory, incomeCategory] = await Promise.all([
      prisma.category.create({ data: { userId, key: 'alimentation-report-test', label: 'Alimentation', kind: 'expense' } }),
      prisma.category.create({ data: { userId, key: 'salaire-report-test', label: 'Salaire', kind: 'income' } }),
    ]);
    expenseCategoryId = expenseCategory.id;
    incomeCategoryId = incomeCategory.id;

    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'Compte rapport', category: 'autre', currency: 'XOF', openingBalance: '10000' });
    accountId = accountRes.body.id;

    await request(app.getHttpServer())
      .post('/budgets')
      .set(...authHeader(accessToken))
      .send({ accountId, categoryId: expenseCategoryId, amount: '20000' });

    await request(app.getHttpServer())
      .post('/transactions')
      .set(...authHeader(accessToken))
      .send({
        accountId,
        type: 'income',
        amount: '80000',
        categoryId: incomeCategoryId,
        occurredAt: new Date().toISOString(),
      });
    await request(app.getHttpServer())
      .post('/transactions')
      .set(...authHeader(accessToken))
      .send({
        accountId,
        type: 'expense',
        amount: '15000',
        categoryId: expenseCategoryId,
        occurredAt: new Date().toISOString(),
      });

    await request(app.getHttpServer())
      .post('/goals')
      .set(...authHeader(accessToken))
      .send({ name: 'Fonds urgence rapport', targetAmount: '50000' });

    await request(app.getHttpServer())
      .post('/debts')
      .set(...authHeader(accessToken))
      .send({ type: 'debt', counterpartyName: 'Test rapport', principalAmount: '30000' });

    await request(app.getHttpServer())
      .post('/subscriptions')
      .set(...authHeader(accessToken))
      .send({
        name: 'Abonnement rapport',
        amount: '5000',
        billingFrequency: 'monthly',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
  });

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { userId } });
    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.debtPayment.deleteMany({ where: { debt: { userId } } });
    await prisma.debt.deleteMany({ where: { userId } });
    await prisma.goalContribution.deleteMany({ where: { goal: { userId } } });
    await prisma.goal.deleteMany({ where: { userId } });
    await prisma.budget.deleteMany({ where: { accountId } });
    await prisma.transaction.deleteMany({ where: { accountId } });
    await prisma.accountBalanceEntry.deleteMany({ where: { accountId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('rejette les requêtes sans access token', async () => {
    await request(app.getHttpServer()).get('/reports').expect(401);
    await request(app.getHttpServer()).post('/reports/generate').send({}).expect(401);
  });

  it('génère un rapport qui agrège tous les domaines pour la période courante', async () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const res = await request(app.getHttpServer())
      .post('/reports/generate')
      .set(...authHeader(accessToken))
      .send({ from, to })
      .expect(201);

    expect(res.body.snapshot.accounts).toHaveLength(1);
    expect(res.body.snapshot.accounts[0].currentBalance).toBe('75000.00'); // 10000 + 80000 - 15000

    expect(res.body.snapshot.cashFlow.totalIncome).toBe('80000.00');
    expect(res.body.snapshot.cashFlow.totalExpense).toBe('15000.00');
    expect(res.body.snapshot.cashFlow.netFlow).toBe('65000.00');

    expect(res.body.snapshot.budgets).toHaveLength(1);
    expect(res.body.snapshot.budgets[0].spent).toBe('15000.00');

    expect(res.body.snapshot.goals.some((g: { name: string }) => g.name === 'Fonds urgence rapport')).toBe(true);
    expect(res.body.snapshot.debts.some((d: { counterpartyName: string }) => d.counterpartyName === 'Test rapport')).toBe(
      true,
    );
    expect(res.body.snapshot.subscriptions.totalMonthlyRecurring).toBe('5000.00');
  });

  it('utilise un titre personnalisé quand fourni, sinon un titre par défaut basé sur la période', async () => {
    const withTitle = await request(app.getHttpServer())
      .post('/reports/generate')
      .set(...authHeader(accessToken))
      .send({ title: 'Rapport perso' })
      .expect(201);
    expect(withTitle.body.title).toBe('Rapport perso');

    const withoutTitle = await request(app.getHttpServer())
      .post('/reports/generate')
      .set(...authHeader(accessToken))
      .send({})
      .expect(201);
    expect(withoutTitle.body.title).toMatch(/^Rapport du \d{4}-\d{2}-\d{2} au \d{4}-\d{2}-\d{2}$/);
  });

  it('rejette une période invalide (from après to)', async () => {
    await request(app.getHttpServer())
      .post('/reports/generate')
      .set(...authHeader(accessToken))
      .send({ from: '2026-06-30T00:00:00.000Z', to: '2026-06-01T00:00:00.000Z' })
      .expect(400);
  });

  it('liste les rapports générés, puis en supprime un', async () => {
    const genRes = await request(app.getHttpServer())
      .post('/reports/generate')
      .set(...authHeader(accessToken))
      .send({ title: 'À supprimer' })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/reports')
      .set(...authHeader(accessToken))
      .expect(200);
    expect(listRes.body.some((r: { id: string }) => r.id === genRes.body.id)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/reports/${genRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/reports/${genRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(404);
  });

  it("renvoie 404 (jamais 403) pour le rapport d'un autre utilisateur", async () => {
    const otherUser = await registerTestUser(app, {
      email: `reports-e2e-other-${Date.now()}@finza.test`,
      fullName: 'Autre utilisateur',
    });

    const genRes = await request(app.getHttpServer())
      .post('/reports/generate')
      .set(...authHeader(otherUser.accessToken))
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .get(`/reports/${genRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(404);

    await prisma.report.delete({ where: { id: genRes.body.id } });
    await prisma.user.delete({ where: { id: otherUser.userId } });
  });
});
