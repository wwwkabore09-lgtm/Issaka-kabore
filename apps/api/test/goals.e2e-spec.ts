import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GoalsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let accountId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const user = await prisma.user.create({
      data: { email: `goals-e2e-${Date.now()}@finza.test`, fullName: 'Test User' },
    });
    userId = user.id;

    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .send({ userId, name: 'Compte épargne', type: 'cash', currency: 'XOF' });
    accountId = accountRes.body.id;
  });

  afterAll(async () => {
    await prisma.goalContribution.deleteMany({ where: { goal: { userId } } });
    await prisma.goal.deleteMany({ where: { userId } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('crée un objectif puis reflète les contributions dans la progression', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/goals')
      .send({ userId, accountId, name: 'Fonds urgence', targetAmount: '300000' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${createRes.body.id}/contributions`)
      .send({ userId, amount: '90000', contributedAt: '2026-06-01T00:00:00.000Z' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/goals/${createRes.body.id}`)
      .query({ userId })
      .expect(200);

    expect(detail.body.currentAmount).toBe('90000.00');
    expect(detail.body.remaining).toBe('210000.00');
    expect(detail.body.percentage).toBe(30);
    expect(detail.body.isAchieved).toBe(false);
  });

  it('marque un objectif comme atteint après une contribution suffisante', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/goals')
      .send({ userId, name: 'Petit objectif', targetAmount: '5000' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${createRes.body.id}/contributions`)
      .send({ userId, amount: '5000' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/goals/${createRes.body.id}`)
      .query({ userId })
      .expect(200);

    expect(detail.body.isAchieved).toBe(true);
  });

  it('rejette un objectif rattaché au compte de quelqu\'un d\'autre', async () => {
    const otherUser = await prisma.user.create({
      data: { email: `goals-e2e-other-${Date.now()}@finza.test`, fullName: 'Autre utilisateur' },
    });
    const otherAccount = await prisma.account.create({
      data: { userId: otherUser.id, name: 'Compte externe', type: 'cash', currency: 'XOF' },
    });

    await request(app.getHttpServer())
      .post('/goals')
      .send({ userId, accountId: otherAccount.id, name: 'Objectif invalide', targetAmount: '1000' })
      .expect(404);

    await prisma.account.delete({ where: { id: otherAccount.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it('liste les contributions les plus récentes en premier', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/goals')
      .send({ userId, name: 'Objectif historique', targetAmount: '100000' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/goals/${createRes.body.id}/contributions`)
      .send({ userId, amount: '10000', contributedAt: '2026-01-01T00:00:00.000Z' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/goals/${createRes.body.id}/contributions`)
      .send({ userId, amount: '20000', contributedAt: '2026-03-01T00:00:00.000Z' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/goals/${createRes.body.id}/contributions`)
      .query({ userId })
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].amount).toBe('20000.00');
    expect(res.body[1].amount).toBe('10000.00');
  });

  it('met à jour puis supprime un objectif', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/goals')
      .send({ userId, name: 'À renommer', targetAmount: '10000' })
      .expect(201);

    const patched = await request(app.getHttpServer())
      .patch(`/goals/${createRes.body.id}`)
      .query({ userId })
      .send({ name: 'Renommé', targetAmount: '15000' })
      .expect(200);
    expect(patched.body.name).toBe('Renommé');
    expect(patched.body.targetAmount).toBe('15000.00');

    await request(app.getHttpServer())
      .delete(`/goals/${createRes.body.id}`)
      .query({ userId })
      .expect(204);

    await request(app.getHttpServer())
      .get(`/goals/${createRes.body.id}`)
      .query({ userId })
      .expect(404);
  });
});
