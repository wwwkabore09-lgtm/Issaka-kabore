import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerTestUser } from './utils/auth';

describe('BudgetsController (e2e)', () => {
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

    const user = await registerTestUser(app, { email: `budgets-e2e-${Date.now()}@finza.test`, fullName: 'Test User' });
    userId = user.userId;
    accessToken = user.accessToken;

    const [expenseCategory, incomeCategory] = await Promise.all([
      prisma.category.create({ data: { userId, key: 'alimentation-test', label: 'Alimentation (test)', kind: 'expense' } }),
      prisma.category.create({ data: { userId, key: 'salaire-test', label: 'Salaire (test)', kind: 'income' } }),
    ]);
    expenseCategoryId = expenseCategory.id;
    incomeCategoryId = incomeCategory.id;

    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'Compte budget', type: 'cash', currency: 'XOF', openingBalance: '200000' });
    accountId = accountRes.body.id;
  });

  afterAll(async () => {
    await prisma.budget.deleteMany({ where: { accountId } });
    await prisma.transaction.deleteMany({ where: { accountId } });
    await prisma.accountBalanceEntry.deleteMany({ where: { accountId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('rejette un budget sur une catégorie de revenu', async () => {
    await request(app.getHttpServer())
      .post('/budgets')
      .send({ userId, accountId, categoryId: incomeCategoryId, amount: '10000' })
      .expect(400);
  });

  it('crée un budget puis rejette un doublon sur la même catégorie', async () => {
    await request(app.getHttpServer())
      .post('/budgets')
      .send({ userId, accountId, categoryId: expenseCategoryId, amount: '50000' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/budgets')
      .send({ userId, accountId, categoryId: expenseCategoryId, amount: '10000' })
      .expect(409);
  });

  it('reflète les dépenses de la période dans la progression du budget', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .send({
        userId,
        accountId,
        type: 'expense',
        amount: '15000',
        categoryId: expenseCategoryId,
        occurredAt: new Date().toISOString(),
      })
      .expect(201);

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const res = await request(app.getHttpServer())
      .get('/budgets')
      .query({ userId, accountId, from, to })
      .expect(200);

    const progress = res.body.find((b: { categoryId: string }) => b.categoryId === expenseCategoryId);
    expect(progress).toBeDefined();
    expect(progress.limit).toBe('50000.00');
    expect(progress.spent).toBe('15000.00');
    expect(progress.remaining).toBe('35000.00');
    expect(progress.percentage).toBe(30);
  });

  it('met à jour puis supprime un budget', async () => {
    const created = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'Autre compte', type: 'cash', currency: 'XOF' });
    const otherAccountId = created.body.id;

    const budgetRes = await request(app.getHttpServer())
      .post('/budgets')
      .send({ userId, accountId: otherAccountId, categoryId: expenseCategoryId, amount: '20000' })
      .expect(201);

    const patched = await request(app.getHttpServer())
      .patch(`/budgets/${budgetRes.body.id}`)
      .query({ userId })
      .send({ amount: '25000' })
      .expect(200);
    expect(patched.body.amount).toBe('25000.00');

    await request(app.getHttpServer())
      .delete(`/budgets/${budgetRes.body.id}`)
      .query({ userId })
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get('/budgets')
      .query({ userId, accountId: otherAccountId })
      .expect(200);
    expect(listAfterDelete.body).toHaveLength(0);
  });

  it("renvoie 404 pour un budget d'un autre utilisateur", async () => {
    const otherUser = await prisma.user.create({
      data: { email: `budgets-e2e-other-${Date.now()}@finza.test`, fullName: 'Autre utilisateur' },
    });
    const otherAccount = await prisma.account.create({
      data: { userId: otherUser.id, name: 'Compte externe', type: 'cash', currency: 'XOF' },
    });
    const otherCategory = await prisma.category.create({
      data: { userId: otherUser.id, key: 'transport-other', label: 'Transport', kind: 'expense' },
    });
    const otherBudget = await prisma.budget.create({
      data: { accountId: otherAccount.id, categoryId: otherCategory.id, amount: new Prisma.Decimal('1000') },
    });

    await request(app.getHttpServer())
      .patch(`/budgets/${otherBudget.id}`)
      .query({ userId })
      .send({ amount: '2000' })
      .expect(404);

    await prisma.budget.delete({ where: { id: otherBudget.id } });
    await prisma.category.delete({ where: { id: otherCategory.id } });
    await prisma.account.delete({ where: { id: otherAccount.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });
});
