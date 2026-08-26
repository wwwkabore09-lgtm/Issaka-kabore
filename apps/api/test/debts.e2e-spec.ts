import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerTestUser } from './utils/auth';

describe('DebtsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const user = await registerTestUser(app, { email: `debts-e2e-${Date.now()}@finza.test`, fullName: 'Test User' });
    userId = user.userId;
    accessToken = user.accessToken;
  });

  afterAll(async () => {
    await prisma.debtPayment.deleteMany({ where: { debt: { userId } } });
    await prisma.debt.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('rejette les requêtes sans access token', async () => {
    await request(app.getHttpServer()).get('/debts').expect(401);
    await request(app.getHttpServer())
      .post('/debts')
      .send({ type: 'debt', counterpartyName: 'Sans token', principalAmount: '1000' })
      .expect(401);
  });

  it('crée une dette (je dois) puis reflète les paiements dans la progression', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/debts')
      .set(...authHeader(accessToken))
      .send({ type: 'debt', counterpartyName: 'Boubacar', principalAmount: '100000' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/debts/${createRes.body.id}/payments`)
      .set(...authHeader(accessToken))
      .send({ amount: '30000', paidAt: '2026-06-01T00:00:00.000Z' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/debts/${createRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(200);

    expect(detail.body.type).toBe('debt');
    expect(detail.body.paidAmount).toBe('30000.00');
    expect(detail.body.remaining).toBe('70000.00');
    expect(detail.body.percentage).toBe(30);
    expect(detail.body.isSettled).toBe(false);
  });

  it('marque une créance (on me doit) comme soldée après remboursement intégral', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/debts')
      .set(...authHeader(accessToken))
      .send({ type: 'credit', counterpartyName: 'Awa', principalAmount: '15000' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/debts/${createRes.body.id}/payments`)
      .set(...authHeader(accessToken))
      .send({ amount: '15000' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/debts/${createRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(200);

    expect(detail.body.isSettled).toBe(true);
  });

  it('filtre la liste par direction (debt vs credit)', async () => {
    const res = await request(app.getHttpServer())
      .get('/debts')
      .set(...authHeader(accessToken))
      .query({ type: 'credit' })
      .expect(200);

    expect(res.body.every((d: { type: string }) => d.type === 'credit')).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("rejette une dette rattachée au compte de quelqu'un d'autre", async () => {
    const otherUser = await prisma.user.create({
      data: { email: `debts-e2e-other-${Date.now()}@finza.test`, fullName: 'Autre utilisateur' },
    });
    const otherAccount = await prisma.account.create({
      data: { userId: otherUser.id, name: 'Compte externe', type: 'cash', currency: 'XOF' },
    });

    await request(app.getHttpServer())
      .post('/debts')
      .set(...authHeader(accessToken))
      .send({ type: 'debt', counterpartyName: 'Test', accountId: otherAccount.id, principalAmount: '1000' })
      .expect(404);

    await prisma.account.delete({ where: { id: otherAccount.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it('liste les paiements les plus récents en premier', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/debts')
      .set(...authHeader(accessToken))
      .send({ type: 'debt', counterpartyName: 'Historique', principalAmount: '100000' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/debts/${createRes.body.id}/payments`)
      .set(...authHeader(accessToken))
      .send({ amount: '10000', paidAt: '2026-01-01T00:00:00.000Z' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/debts/${createRes.body.id}/payments`)
      .set(...authHeader(accessToken))
      .send({ amount: '20000', paidAt: '2026-03-01T00:00:00.000Z' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/debts/${createRes.body.id}/payments`)
      .set(...authHeader(accessToken))
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].amount).toBe('20000.00');
    expect(res.body[1].amount).toBe('10000.00');
  });

  it('met à jour puis supprime une dette', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/debts')
      .set(...authHeader(accessToken))
      .send({ type: 'debt', counterpartyName: 'À renommer', principalAmount: '10000' })
      .expect(201);

    const patched = await request(app.getHttpServer())
      .patch(`/debts/${createRes.body.id}`)
      .set(...authHeader(accessToken))
      .send({ counterpartyName: 'Renommé', principalAmount: '15000' })
      .expect(200);
    expect(patched.body.counterpartyName).toBe('Renommé');
    expect(patched.body.principalAmount).toBe('15000.00');

    await request(app.getHttpServer())
      .delete(`/debts/${createRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/debts/${createRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(404);
  });
});
