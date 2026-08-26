import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('TransactionsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let accountAId: string;
  let accountBId: string;
  let incomeCategoryId: string;
  let expenseCategoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const user = await prisma.user.create({
      data: { email: `transactions-e2e-${Date.now()}@finza.test`, fullName: 'Test User' },
    });
    userId = user.id;

    const [income, expense] = await Promise.all([
      prisma.category.create({ data: { userId, key: 'salaire-test', label: 'Salaire (test)', kind: 'income' } }),
      prisma.category.create({ data: { userId, key: 'transport-test', label: 'Transport (test)', kind: 'expense' } }),
    ]);
    incomeCategoryId = income.id;
    expenseCategoryId = expense.id;

    const [accountA, accountB] = await Promise.all([
      request(app.getHttpServer())
        .post('/accounts')
        .send({ userId, name: 'Compte A', type: 'orange_money', currency: 'XOF', openingBalance: '100000' }),
      request(app.getHttpServer())
        .post('/accounts')
        .send({ userId, name: 'Compte B', type: 'bank_account', currency: 'XOF' }),
    ]);
    accountAId = accountA.body.id;
    accountBId = accountB.body.id;
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({ where: { accountId: { in: [accountAId, accountBId] } } });
    await prisma.accountBalanceEntry.deleteMany({ where: { accountId: { in: [accountAId, accountBId] } } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('une dépense diminue le solde du compte', async () => {
    const res = await request(app.getHttpServer())
      .post('/transactions')
      .send({
        userId,
        accountId: accountAId,
        type: 'expense',
        amount: '15000',
        categoryId: expenseCategoryId,
        occurredAt: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);

    expect(res.body).toMatchObject({ type: 'expense', amount: '15000.00', categoryId: expenseCategoryId });

    const balance = await request(app.getHttpServer())
      .get(`/accounts/${accountAId}/balance`)
      .query({ userId })
      .expect(200);

    expect(balance.body.balance).toBe('85000.00');
  });

  it('un revenu augmente le solde du compte', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .send({
        userId,
        accountId: accountAId,
        type: 'income',
        amount: '20000',
        categoryId: incomeCategoryId,
        occurredAt: '2026-06-02T00:00:00.000Z',
      })
      .expect(201);

    const balance = await request(app.getHttpServer())
      .get(`/accounts/${accountAId}/balance`)
      .query({ userId })
      .expect(200);

    expect(balance.body.balance).toBe('105000.00');
  });

  it('rejette une transaction income/expense sans categoryId', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .send({ userId, accountId: accountAId, type: 'expense', amount: '1000' })
      .expect(400);
  });

  it('un transfert déplace le solde entre deux comptes et est exclu du résumé revenus/dépenses', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .send({
        userId,
        accountId: accountAId,
        type: 'transfer',
        amount: '30000',
        transferToAccountId: accountBId,
        occurredAt: '2026-06-03T00:00:00.000Z',
      })
      .expect(201);

    const [balanceA, balanceB] = await Promise.all([
      request(app.getHttpServer()).get(`/accounts/${accountAId}/balance`).query({ userId }).expect(200),
      request(app.getHttpServer()).get(`/accounts/${accountBId}/balance`).query({ userId }).expect(200),
    ]);

    expect(balanceA.body.balance).toBe('75000.00');
    expect(balanceB.body.balance).toBe('30000.00');

    const summary = await request(app.getHttpServer())
      .get('/transactions/summary')
      .query({ userId, accountId: accountAId, from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.000Z' })
      .expect(200);

    // 20000 income - 15000 expense = 5000, le transfert de 30000 ne doit apparaître nulle part ici.
    expect(summary.body.totalIncome).toBe('20000.00');
    expect(summary.body.totalExpense).toBe('15000.00');
    expect(summary.body.netFlow).toBe('5000.00');
  });

  it('rejette un transfert vers un compte qui n\'appartient pas à l\'utilisateur', async () => {
    const otherUser = await prisma.user.create({
      data: { email: `transactions-e2e-other-${Date.now()}@finza.test`, fullName: 'Autre utilisateur' },
    });
    const otherAccount = await prisma.account.create({
      data: { userId: otherUser.id, name: 'Compte externe', type: 'cash', currency: 'XOF' },
    });

    await request(app.getHttpServer())
      .post('/transactions')
      .send({ userId, accountId: accountAId, type: 'transfer', amount: '1000', transferToAccountId: otherAccount.id })
      .expect(404);

    await prisma.account.delete({ where: { id: otherAccount.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it('liste les transactions du compte, plus récentes en premier', async () => {
    const res = await request(app.getHttpServer())
      .get('/transactions')
      .query({ userId, accountId: accountAId })
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(3);
    const dates = res.body.map((t: { occurredAt: string }) => new Date(t.occurredAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});
