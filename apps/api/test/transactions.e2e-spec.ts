import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerTestUser } from './utils/auth';

describe('TransactionsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let accessToken: string;
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

    const user = await registerTestUser(app, { email: `transactions-e2e-${Date.now()}@finza.test`, fullName: 'Test User' });
    userId = user.userId;
    accessToken = user.accessToken;

    const [income, expense] = await Promise.all([
      prisma.category.create({ data: { userId, key: 'salaire-test', label: 'Salaire (test)', kind: 'income' } }),
      prisma.category.create({ data: { userId, key: 'transport-test', label: 'Transport (test)', kind: 'expense' } }),
    ]);
    incomeCategoryId = income.id;
    expenseCategoryId = expense.id;

    const [accountA, accountB] = await Promise.all([
      request(app.getHttpServer())
        .post('/accounts')
        .set(...authHeader(accessToken))
        .send({ name: 'Compte A', category: 'salaire', currency: 'XOF', openingBalance: '100000' }),
      request(app.getHttpServer())
        .post('/accounts')
        .set(...authHeader(accessToken))
        .send({ name: 'Compte B', category: 'commerce', currency: 'XOF' }),
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

  it('rejette les requêtes sans access token', async () => {
    await request(app.getHttpServer()).get('/transactions').query({ accountId: accountAId }).expect(401);
    await request(app.getHttpServer())
      .post('/transactions')
      .send({ accountId: accountAId, type: 'expense', amount: '1000', categoryId: expenseCategoryId })
      .expect(401);
  });

  it('une dépense diminue le solde du compte', async () => {
    const res = await request(app.getHttpServer())
      .post('/transactions')
      .set(...authHeader(accessToken))
      .send({
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
      .set(...authHeader(accessToken))
      .expect(200);

    expect(balance.body.balance).toBe('85000.00');
  });

  it('un revenu augmente le solde du compte', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .set(...authHeader(accessToken))
      .send({
        accountId: accountAId,
        type: 'income',
        amount: '20000',
        categoryId: incomeCategoryId,
        occurredAt: '2026-06-02T00:00:00.000Z',
      })
      .expect(201);

    const balance = await request(app.getHttpServer())
      .get(`/accounts/${accountAId}/balance`)
      .set(...authHeader(accessToken))
      .expect(200);

    expect(balance.body.balance).toBe('105000.00');
  });

  it('rejette une transaction income/expense sans categoryId', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .set(...authHeader(accessToken))
      .send({ accountId: accountAId, type: 'expense', amount: '1000' })
      .expect(400);
  });

  it('un transfert déplace le solde entre deux comptes et est exclu du résumé revenus/dépenses', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .set(...authHeader(accessToken))
      .send({
        accountId: accountAId,
        type: 'transfer',
        amount: '30000',
        transferToAccountId: accountBId,
        occurredAt: '2026-06-03T00:00:00.000Z',
      })
      .expect(201);

    const [balanceA, balanceB] = await Promise.all([
      request(app.getHttpServer()).get(`/accounts/${accountAId}/balance`).set(...authHeader(accessToken)).expect(200),
      request(app.getHttpServer()).get(`/accounts/${accountBId}/balance`).set(...authHeader(accessToken)).expect(200),
    ]);

    expect(balanceA.body.balance).toBe('75000.00');
    expect(balanceB.body.balance).toBe('30000.00');

    const summary = await request(app.getHttpServer())
      .get('/transactions/summary')
      .set(...authHeader(accessToken))
      .query({ accountId: accountAId, from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T23:59:59.000Z' })
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
      data: { userId: otherUser.id, name: 'Compte externe', category: 'autre', currency: 'XOF' },
    });

    await request(app.getHttpServer())
      .post('/transactions')
      .set(...authHeader(accessToken))
      .send({ accountId: accountAId, type: 'transfer', amount: '1000', transferToAccountId: otherAccount.id })
      .expect(404);

    await prisma.account.delete({ where: { id: otherAccount.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it('liste les transactions du compte, plus récentes en premier', async () => {
    const res = await request(app.getHttpServer())
      .get('/transactions')
      .set(...authHeader(accessToken))
      .query({ accountId: accountAId })
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(3);
    const dates = res.body.map((t: { occurredAt: string }) => new Date(t.occurredAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  describe('mise à jour et suppression (append-only)', () => {
    let expenseTxId: string;
    let incomeTxId: string;
    let transferTxId: string;
    let secondIncomeCategoryId: string;

    beforeAll(async () => {
      const listRes = await request(app.getHttpServer())
        .get('/transactions')
        .set(...authHeader(accessToken))
        .query({ accountId: accountAId })
        .expect(200);

      expenseTxId = listRes.body.find((t: { type: string }) => t.type === 'expense').id;
      incomeTxId = listRes.body.find((t: { type: string }) => t.type === 'income').id;
      transferTxId = listRes.body.find((t: { type: string }) => t.type === 'transfer').id;

      const category = await prisma.category.create({
        data: { userId, key: 'prime-test', label: 'Prime (test)', kind: 'income' },
      });
      secondIncomeCategoryId = category.id;
    });

    it("modifie le montant d'une dépense : ajuste le solde par une écriture compensatoire, sans réécrire l'historique", async () => {
      const patchRes = await request(app.getHttpServer())
        .patch(`/transactions/${expenseTxId}`)
        .set(...authHeader(accessToken))
        .send({ amount: '18000' })
        .expect(200);

      expect(patchRes.body.amount).toBe('18000.00');

      const balance = await request(app.getHttpServer())
        .get(`/accounts/${accountAId}/balance`)
        .set(...authHeader(accessToken))
        .expect(200);

      // 75000 - (18000 - 15000) = 72000 : la dépense augmente de 3000, le solde baisse d'autant.
      expect(balance.body.balance).toBe('72000.00');
    });

    it('modifie la catégorie et la description d\'un revenu sans toucher au solde', async () => {
      const patchRes = await request(app.getHttpServer())
        .patch(`/transactions/${incomeTxId}`)
        .set(...authHeader(accessToken))
        .send({ categoryId: secondIncomeCategoryId, description: 'Salaire de juin' })
        .expect(200);

      expect(patchRes.body).toMatchObject({ categoryId: secondIncomeCategoryId, description: 'Salaire de juin' });

      const balance = await request(app.getHttpServer())
        .get(`/accounts/${accountAId}/balance`)
        .set(...authHeader(accessToken))
        .expect(200);

      expect(balance.body.balance).toBe('72000.00');
    });

    it('refuse de modifier le montant ou la catégorie d\'un transfert, mais autorise sa description', async () => {
      await request(app.getHttpServer())
        .patch(`/transactions/${transferTxId}`)
        .set(...authHeader(accessToken))
        .send({ amount: '5000' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/transactions/${transferTxId}`)
        .set(...authHeader(accessToken))
        .send({ categoryId: secondIncomeCategoryId })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/transactions/${transferTxId}`)
        .set(...authHeader(accessToken))
        .send({ description: 'Épargne vers compte B' })
        .expect(200);
    });

    it("supprime une dépense : restaure le solde par une écriture compensatoire", async () => {
      await request(app.getHttpServer())
        .delete(`/transactions/${expenseTxId}`)
        .set(...authHeader(accessToken))
        .expect(204);

      const balance = await request(app.getHttpServer())
        .get(`/accounts/${accountAId}/balance`)
        .set(...authHeader(accessToken))
        .expect(200);

      expect(balance.body.balance).toBe('90000.00');

      const list = await request(app.getHttpServer())
        .get('/transactions')
        .set(...authHeader(accessToken))
        .query({ accountId: accountAId })
        .expect(200);

      expect(list.body.some((t: { id: string }) => t.id === expenseTxId)).toBe(false);
    });

    it('supprime un transfert : restaure le solde des deux comptes', async () => {
      await request(app.getHttpServer())
        .delete(`/transactions/${transferTxId}`)
        .set(...authHeader(accessToken))
        .expect(204);

      const [balanceA, balanceB] = await Promise.all([
        request(app.getHttpServer()).get(`/accounts/${accountAId}/balance`).set(...authHeader(accessToken)).expect(200),
        request(app.getHttpServer()).get(`/accounts/${accountBId}/balance`).set(...authHeader(accessToken)).expect(200),
      ]);

      expect(balanceA.body.balance).toBe('120000.00');
      expect(balanceB.body.balance).toBe('0.00');
    });

    it('liste toutes les transactions de l\'utilisateur tous comptes confondus, avec filtres', async () => {
      const all = await request(app.getHttpServer())
        .get('/transactions')
        .set(...authHeader(accessToken))
        .expect(200);

      expect(all.body).toHaveLength(1);
      expect(all.body[0].id).toBe(incomeTxId);

      const byType = await request(app.getHttpServer())
        .get('/transactions')
        .set(...authHeader(accessToken))
        .query({ type: 'expense' })
        .expect(200);
      expect(byType.body).toHaveLength(0);

      const bySearch = await request(app.getHttpServer())
        .get('/transactions')
        .set(...authHeader(accessToken))
        .query({ q: 'juin' })
        .expect(200);
      expect(bySearch.body.map((t: { id: string }) => t.id)).toContain(incomeTxId);
    });

    it('calcule la vue tableau de bord (mois courant/précédent, série mensuelle, répartition par catégorie)', async () => {
      await request(app.getHttpServer())
        .post('/transactions')
        .set(...authHeader(accessToken))
        .send({ accountId: accountAId, type: 'expense', amount: '4000', categoryId: expenseCategoryId })
        .expect(201);

      const overview = await request(app.getHttpServer())
        .get('/transactions/dashboard-overview')
        .set(...authHeader(accessToken))
        .expect(200);

      expect(overview.body.monthlySeries).toHaveLength(6);
      expect(Number(overview.body.currentMonth.totalExpense)).toBeGreaterThanOrEqual(4000);
      // Le solde d'ouverture des comptes (100000 sur accountA) compte comme un revenu, comme
      // pour /transactions/revenue-overview — sinon la page Comptes et le tableau de bord
      // raconteraient deux histoires différentes pour la même donnée.
      expect(Number(overview.body.currentMonth.totalIncome)).toBeGreaterThan(0);
      expect(overview.body.expenseByCategory.length).toBeGreaterThanOrEqual(1);
      const transportRow = overview.body.expenseByCategory.find(
        (row: { categoryId: string }) => row.categoryId === expenseCategoryId,
      );
      expect(transportRow).toBeDefined();
      expect(Number(transportRow.total)).toBeGreaterThanOrEqual(4000);
    });
  });
});
