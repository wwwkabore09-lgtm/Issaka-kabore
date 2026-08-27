import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `auth-e2e-${Date.now()}@finza.test`;
  const password = 'motdepasse123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'auth-e2e-' } } });
    await app.close();
  });

  it('inscrit un utilisateur et ne renvoie jamais le mot de passe', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, fullName: 'Test Auth' })
      .expect(201);

    expect(res.body.user).toMatchObject({ email, fullName: 'Test Auth' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(password);
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
  });

  it('rejette une seconde inscription avec le même email (409)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, fullName: 'Doublon' })
      .expect(409);
  });

  it('rejette un mot de passe trop court', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `auth-e2e-short-${Date.now()}@finza.test`, password: '123', fullName: 'Trop court' })
      .expect(400);
  });

  it('se connecte avec les bons identifiants, rejette les mauvais', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    expect(loginRes.body.user.email).toBe(email);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'mauvais-mot-de-passe' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'personne@finza.test', password: 'peu-importe123' })
      .expect(401);
  });

  it('protège GET /auth/me et retourne l\'utilisateur avec un token valide', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer token-invalide').expect(401);

    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.tokens.accessToken}`)
      .expect(200);

    expect(meRes.body.email).toBe(email);
  });

  it('rafraîchit les tokens (rotation) puis invalide l\'ancien refresh token', async () => {
    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    const originalRefreshToken = loginRes.body.tokens.refreshToken;

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: originalRefreshToken })
      .expect(200);

    expect(refreshRes.body.refreshToken).not.toBe(originalRefreshToken);

    // L'ancien refresh token ne doit plus fonctionner (rotation).
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: originalRefreshToken })
      .expect(401);

    // Le nouveau fonctionne.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refreshRes.body.refreshToken })
      .expect(200);
  });

  it('logout invalide le refresh token', async () => {
    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    const refreshToken = loginRes.body.tokens.refreshToken;

    await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken }).expect(204);

    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401);

    // Logout est idempotent : un second appel sur un jeton déjà révoqué ne plante pas.
    await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken }).expect(204);
  });

  it('bloque après trop de tentatives de connexion (429)', async () => {
    let sawTooManyRequests = false;
    for (let i = 0; i < 15; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'mauvais-mot-de-passe' });
      if (res.status === 429) {
        sawTooManyRequests = true;
        break;
      }
    }
    expect(sawTooManyRequests).toBe(true);
  });
});
