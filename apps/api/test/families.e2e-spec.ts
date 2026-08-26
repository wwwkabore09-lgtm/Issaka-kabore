import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { authHeader, registerTestUser } from './utils/auth';

describe('FamiliesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let ownerToken: string;
  let memberId: string;
  let memberToken: string;
  let outsiderId: string;
  let outsiderToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const [owner, member, outsider] = await Promise.all([
      registerTestUser(app, { email: `families-owner-${Date.now()}@finza.test`, fullName: 'Propriétaire' }),
      registerTestUser(app, { email: `families-member-${Date.now()}@finza.test`, fullName: 'Membre' }),
      registerTestUser(app, { email: `families-outsider-${Date.now()}@finza.test`, fullName: 'Externe' }),
    ]);
    ownerId = owner.userId;
    ownerToken = owner.accessToken;
    memberId = member.userId;
    memberToken = member.accessToken;
    outsiderId = outsider.userId;
    outsiderToken = outsider.accessToken;
  });

  afterAll(async () => {
    await prisma.account.deleteMany({ where: { userId: { in: [ownerId, memberId, outsiderId] } } });
    await prisma.familyMember.deleteMany({ where: { userId: { in: [ownerId, memberId, outsiderId] } } });
    await prisma.family.deleteMany({ where: { ownerId: { in: [ownerId, outsiderId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId, outsiderId] } } });
    await app.close();
  });

  it('rejette les requêtes sans access token', async () => {
    await request(app.getHttpServer()).get('/families').expect(401);
    await request(app.getHttpServer()).post('/families').send({ name: 'Sans token' }).expect(401);
  });

  async function getMyFamily(accessToken: string) {
    const res = await request(app.getHttpServer())
      .get('/families')
      .set(...authHeader(accessToken))
      .expect(200);
    return res.body[0] ?? null;
  }

  it('crée une famille, y ajoute un membre, et un second create est rejeté (409)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/families')
      .set(...authHeader(ownerToken))
      .send({ name: 'Famille Kaboré' })
      .expect(201);

    expect(createRes.body.members).toHaveLength(1);
    expect(createRes.body.members[0].role).toBe('owner');

    await request(app.getHttpServer())
      .post('/families')
      .set(...authHeader(ownerToken))
      .send({ name: 'Autre famille' })
      .expect(409);

    const addRes = await request(app.getHttpServer())
      .post(`/families/${createRes.body.id}/members`)
      .set(...authHeader(ownerToken))
      .send({ memberUserId: memberId })
      .expect(201);

    expect(addRes.body.members).toHaveLength(2);
    expect(addRes.body.members.some((m: { userId: string }) => m.userId === memberId)).toBe(true);
  });

  it("empêche un non-propriétaire d'ajouter un membre", async () => {
    const family = await getMyFamily(ownerToken);

    await request(app.getHttpServer())
      .post(`/families/${family.id}/members`)
      .set(...authHeader(memberToken))
      .send({ memberUserId: outsiderId })
      .expect(404);
  });

  it('un compte non partagé reste invisible aux autres membres de la famille (règle non négociable)', async () => {
    const family = await getMyFamily(ownerToken);

    // Le propriétaire crée un compte personnel, non partagé par défaut.
    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(ownerToken))
      .send({ name: 'Compte perso propriétaire', type: 'cash', currency: 'XOF', openingBalance: '50000' })
      .expect(201);
    expect(accountRes.body.isSharedWithFamily).toBe(false);

    // Le membre ne le voit pas dans la vue partagée de la famille.
    const sharedBefore = await request(app.getHttpServer())
      .get(`/families/${family.id}/shared-accounts`)
      .set(...authHeader(memberToken))
      .expect(200);
    expect(sharedBefore.body.some((a: { id: string }) => a.id === accountRes.body.id)).toBe(false);

    // Le propriétaire partage explicitement le compte.
    await request(app.getHttpServer())
      .patch(`/accounts/${accountRes.body.id}`)
      .set(...authHeader(ownerToken))
      .send({ isSharedWithFamily: true })
      .expect(200);

    // Maintenant le membre le voit, avec uniquement nom/devise/solde/propriétaire.
    const sharedAfter = await request(app.getHttpServer())
      .get(`/families/${family.id}/shared-accounts`)
      .set(...authHeader(memberToken))
      .expect(200);
    const shared = sharedAfter.body.find((a: { id: string }) => a.id === accountRes.body.id);
    expect(shared).toMatchObject({
      name: 'Compte perso propriétaire',
      currency: 'XOF',
      currentBalance: '50000.00',
      ownerUserId: ownerId,
      ownerName: 'Propriétaire',
    });
  });

  it("rejette le partage d'un compte pour un utilisateur sans famille", async () => {
    const accountRes = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(outsiderToken))
      .send({ name: 'Compte externe', type: 'cash', currency: 'XOF' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/accounts/${accountRes.body.id}`)
      .set(...authHeader(outsiderToken))
      .send({ isSharedWithFamily: true })
      .expect(400);
  });

  it('empêche un externe de voir les comptes partagés de la famille (404, pas 403)', async () => {
    const family = await getMyFamily(ownerToken);

    await request(app.getHttpServer())
      .get(`/families/${family.id}/shared-accounts`)
      .set(...authHeader(outsiderToken))
      .expect(404);
  });

  it('permet à un membre de quitter la famille, mais pas au propriétaire', async () => {
    const family = await getMyFamily(ownerToken);

    await request(app.getHttpServer())
      .delete(`/families/${family.id}/members/${memberId}`)
      .set(...authHeader(memberToken))
      .expect(204);

    const afterLeave = await getMyFamily(memberToken);
    expect(afterLeave).toBeNull();

    await request(app.getHttpServer())
      .delete(`/families/${family.id}/members/${ownerId}`)
      .set(...authHeader(ownerToken))
      .expect(400);
  });

  it("retourne un tableau vide pour un utilisateur sans famille", async () => {
    const res = await request(app.getHttpServer())
      .get('/families')
      .set(...authHeader(outsiderToken))
      .expect(200);
    expect(res.body).toEqual([]);
  });
});
