import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerTestUser } from './utils/auth';

describe('CategoriesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAId: string;
  let userAToken: string;
  let userBId: string;
  let userBToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const userA = await registerTestUser(app, { email: `categories-a-e2e-${Date.now()}@finza.test`, fullName: 'User A' });
    userAId = userA.userId;
    userAToken = userA.accessToken;

    const userB = await registerTestUser(app, { email: `categories-b-e2e-${Date.now()}@finza.test`, fullName: 'User B' });
    userBId = userB.userId;
    userBToken = userB.accessToken;

    await prisma.category.create({
      data: { userId: userAId, key: 'perso_a', label: 'Catégorie privée A', kind: 'expense' },
    });
  });

  afterAll(async () => {
    await prisma.category.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await app.close();
  });

  it('rejette les requêtes sans access token', async () => {
    await request(app.getHttpServer()).get('/categories').expect(401);
  });

  it("ignore tout userId fourni en query et retourne toujours les catégories de l'appelant authentifié", async () => {
    const res = await request(app.getHttpServer())
      .get(`/categories?userId=${userAId}`)
      .set(...authHeader(userBToken))
      .expect(200);

    expect(res.body.some((c: { label: string }) => c.label === 'Catégorie privée A')).toBe(false);
  });

  it("ne retourne jamais les catégories privées d'un autre utilisateur", async () => {
    const resA = await request(app.getHttpServer()).get('/categories').set(...authHeader(userAToken)).expect(200);
    expect(resA.body.some((c: { label: string }) => c.label === 'Catégorie privée A')).toBe(true);

    const resB = await request(app.getHttpServer()).get('/categories').set(...authHeader(userBToken)).expect(200);
    expect(resB.body.some((c: { label: string }) => c.label === 'Catégorie privée A')).toBe(false);
  });
});
