import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('SubscriptionsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const user = await prisma.user.create({
      data: { email: `subscriptions-e2e-${Date.now()}@finza.test`, fullName: 'Test User' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('crée un abonnement mensuel et le retrouve dans la liste', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/subscriptions')
      .send({
        userId,
        name: 'Netflix',
        amount: '6000',
        billingFrequency: 'monthly',
        nextBillingDate: '2026-07-01T00:00:00.000Z',
      })
      .expect(201);

    expect(createRes.body.monthlyEquivalent).toBe('6000.00');

    const listRes = await request(app.getHttpServer())
      .get('/subscriptions')
      .query({ userId })
      .expect(200);

    expect(listRes.body.some((s: { id: string }) => s.id === createRes.body.id)).toBe(true);
  });

  it('agrège le coût mensuel récurrent total, y compris pour un abonnement annuel', async () => {
    await request(app.getHttpServer())
      .post('/subscriptions')
      .send({
        userId,
        name: 'Assurance moto',
        amount: '120000',
        billingFrequency: 'yearly',
        nextBillingDate: '2027-01-01T00:00:00.000Z',
      })
      .expect(201);

    const summary = await request(app.getHttpServer())
      .get('/subscriptions/summary')
      .query({ userId })
      .expect(200);

    // Netflix (6000/mois) + Assurance (120000/12 = 10000/mois) = 16000
    expect(summary.body.totalMonthlyRecurring).toBe('16000.00');
    expect(summary.body.activeCount).toBe(2);
  });

  it("exclut un abonnement désactivé du résumé", async () => {
    const createRes = await request(app.getHttpServer())
      .post('/subscriptions')
      .send({
        userId,
        name: 'Salle de sport',
        amount: '15000',
        billingFrequency: 'monthly',
        nextBillingDate: '2026-07-01T00:00:00.000Z',
      })
      .expect(201);

    const beforeSummary = await request(app.getHttpServer()).get('/subscriptions/summary').query({ userId }).expect(200);

    await request(app.getHttpServer())
      .patch(`/subscriptions/${createRes.body.id}`)
      .query({ userId })
      .send({ isActive: false })
      .expect(200);

    const afterSummary = await request(app.getHttpServer()).get('/subscriptions/summary').query({ userId }).expect(200);

    expect(Number(afterSummary.body.totalMonthlyRecurring)).toBe(Number(beforeSummary.body.totalMonthlyRecurring) - 15000);

    const activeOnlyList = await request(app.getHttpServer())
      .get('/subscriptions')
      .query({ userId, activeOnly: 'true' })
      .expect(200);
    expect(activeOnlyList.body.some((s: { id: string }) => s.id === createRes.body.id)).toBe(false);
  });

  it('renouvelle un abonnement en avançant sa prochaine échéance d\'un cycle', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/subscriptions')
      .send({
        userId,
        name: 'Forfait mobile',
        amount: '5000',
        billingFrequency: 'monthly',
        nextBillingDate: '2026-06-10T00:00:00.000Z',
      })
      .expect(201);

    const renewRes = await request(app.getHttpServer())
      .post(`/subscriptions/${createRes.body.id}/renew`)
      .send({ userId })
      .expect(201);

    expect(renewRes.body.nextBillingDate).toBe('2026-07-10T00:00:00.000Z');
  });

  it("rejette un abonnement rattaché au compte de quelqu'un d'autre", async () => {
    const otherUser = await prisma.user.create({
      data: { email: `subscriptions-e2e-other-${Date.now()}@finza.test`, fullName: 'Autre utilisateur' },
    });
    const otherAccount = await prisma.account.create({
      data: { userId: otherUser.id, name: 'Compte externe', type: 'cash', currency: 'XOF' },
    });

    await request(app.getHttpServer())
      .post('/subscriptions')
      .send({
        userId,
        accountId: otherAccount.id,
        name: 'Test',
        amount: '1000',
        billingFrequency: 'monthly',
        nextBillingDate: '2026-07-01T00:00:00.000Z',
      })
      .expect(404);

    await prisma.account.delete({ where: { id: otherAccount.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it('supprime un abonnement', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/subscriptions')
      .send({
        userId,
        name: 'À supprimer',
        amount: '1000',
        billingFrequency: 'monthly',
        nextBillingDate: '2026-07-01T00:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/subscriptions/${createRes.body.id}`)
      .query({ userId })
      .expect(204);

    await request(app.getHttpServer())
      .get(`/subscriptions/${createRes.body.id}`)
      .query({ userId })
      .expect(404);
  });
});
