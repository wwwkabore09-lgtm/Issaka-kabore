import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerTestUser } from './utils/auth';

describe('AccountsController (e2e)', () => {
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

    const user = await registerTestUser(app, { email: `accounts-e2e-${Date.now()}@finza.test`, fullName: 'Test User' });
    userId = user.userId;
    accessToken = user.accessToken;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('rejette les requêtes sans access token', async () => {
    await request(app.getHttpServer()).get('/accounts').expect(401);
    await request(app.getHttpServer())
      .post('/accounts')
      .send({ name: 'Compte test', category: 'autre', currency: 'XOF' })
      .expect(401);
  });

  it('crée un compte avec un solde d\'ouverture et le retrouve dans la liste', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({
        name: 'Salaire',
        category: 'salaire',
        currency: 'XOF',
        openingBalance: '25000',
      })
      .expect(201);

    expect(createRes.body).toMatchObject({
      userId,
      name: 'Salaire',
      category: 'salaire',
      frequency: 'monthly',
      ownership: 'personal',
      currency: 'XOF',
      currentBalance: '25000.00',
      isActive: true,
    });

    const listRes = await request(app.getHttpServer())
      .get('/accounts')
      .set(...authHeader(accessToken))
      .expect(200);

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(createRes.body.id);
  });

  it('rejette une devise inconnue (config multi-pays, jamais codée en dur)', async () => {
    await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'Compte test', category: 'autre', currency: 'USD' })
      .expect(400);
  });

  it('rejette une catégorie de revenu inconnue', async () => {
    await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'Compte test', category: 'paypal', currency: 'XOF' })
      .expect(400);
  });

  it('reconstitue le solde à une date donnée à partir du grand livre', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({
        name: 'Argent de poche',
        category: 'argent_de_poche',
        currency: 'XOF',
        openingBalance: '5000',
        openingBalanceDate: '2026-01-01T00:00:00.000Z',
      })
      .expect(201);

    const balanceRes = await request(app.getHttpServer())
      .get(`/accounts/${createRes.body.id}/balance`)
      .set(...authHeader(accessToken))
      .query({ asOf: '2026-06-01T00:00:00.000Z' })
      .expect(200);

    expect(balanceRes.body.balance).toBe('5000.00');
  });

  it('renvoie 404 (jamais 403) pour le compte d\'un autre utilisateur', async () => {
    const other = await registerTestUser(app, {
      email: `accounts-e2e-other-${Date.now()}@finza.test`,
      fullName: 'Autre utilisateur',
    });

    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(other.accessToken))
      .send({ name: 'Compte privé', category: 'autre', currency: 'XOF' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/accounts/${createRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(404);

    await prisma.user.delete({ where: { id: other.userId } });
  });

  it('permet de renommer, recatégoriser et désactiver un compte', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'Freelance', category: 'freelance', currency: 'XOF' })
      .expect(201);

    const patchRes = await request(app.getHttpServer())
      .patch(`/accounts/${createRes.body.id}`)
      .set(...authHeader(accessToken))
      .send({ name: 'Freelance (renommé)', category: 'activite_professionnelle', isActive: false })
      .expect(200);

    expect(patchRes.body.name).toBe('Freelance (renommé)');
    expect(patchRes.body.isActive).toBe(false);
    expect(patchRes.body.category).toBe('activite_professionnelle');
  });

  it('supprime définitivement un compte sans historique, mais refuse si des transactions existent', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'À supprimer', category: 'autre', currency: 'XOF', openingBalance: '1000' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/accounts/${createRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/accounts/${createRes.body.id}`)
      .set(...authHeader(accessToken))
      .expect(404);
  });
});
