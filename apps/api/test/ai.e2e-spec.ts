import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GeminiService } from '../src/ai/gemini.service';
import { AiEmptyResponseError, AiProviderError } from '../src/ai/ai.errors';
import { authHeader, registerTestUser } from './utils/auth';

interface RecordedCall {
  systemInstruction: string;
  history: unknown[];
  message: string;
}

// Remplace le vrai client Gemini : aucun appel réseau pendant les tests, et on peut
// inspecter exactement ce qui aurait été envoyé (le message construit, jamais l'historique
// brut des transactions) sans dépendre d'une vraie clé API.
class FakeGeminiService {
  configured = true;
  lastCall: RecordedCall | null = null;
  nextReply: string | (() => string) = 'Réponse IA simulée.';

  isConfigured(): boolean {
    return this.configured;
  }

  async generateReply(systemInstruction: string, history: unknown[], message: string): Promise<string> {
    this.lastCall = { systemInstruction, history, message };
    return typeof this.nextReply === 'function' ? this.nextReply() : this.nextReply;
  }
}

describe('AiController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeGemini: FakeGeminiService;
  let userId: string;
  let accessToken: string;
  let incomeCategoryId: string;
  let expenseCategoryId: string;

  beforeAll(async () => {
    fakeGemini = new FakeGeminiService();

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GeminiService)
      .useValue(fakeGemini)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const user = await registerTestUser(app, { email: `ai-e2e-${Date.now()}@finza.test`, fullName: 'Aïcha Test' });
    userId = user.userId;
    accessToken = user.accessToken;

    const [income, expense] = await Promise.all([
      prisma.category.create({ data: { userId, key: 'salaire-ai-test', label: 'Salaire', kind: 'income' } }),
      prisma.category.create({ data: { userId, key: 'alimentation-ai-test', label: 'Alimentation', kind: 'expense' } }),
    ]);
    incomeCategoryId = income.id;
    expenseCategoryId = expense.id;
  });

  afterEach(() => {
    fakeGemini.configured = true;
    fakeGemini.nextReply = 'Réponse IA simulée.';
  });

  afterAll(async () => {
    await prisma.goalContribution.deleteMany({ where: { goal: { userId } } });
    await prisma.goal.deleteMany({ where: { userId } });
    await prisma.transaction.deleteMany({ where: { account: { userId } } });
    await prisma.accountBalanceEntry.deleteMany({ where: { account: { userId } } });
    await prisma.account.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  it('rejette les requêtes sans access token', async () => {
    await request(app.getHttpServer()).post('/ai/advice').send({ message: 'Bonjour' }).expect(401);
    await request(app.getHttpServer()).get('/ai/summary').expect(401);
  });

  it("renvoie 503 avec un message clair si la clé Gemini est absente, sans jamais l'exposer", async () => {
    fakeGemini.configured = false;

    const res = await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: 'Comment gérer mes revenus ?' })
      .expect(503);

    expect(res.body.message).toBe("L'assistant IA n'est pas encore configuré.");
    expect(JSON.stringify(res.body)).not.toMatch(/GEMINI_API_KEY/i);
  });

  it("utilisateur sans aucune donnée : le contexte le signale à l'IA plutôt que d'inventer des chiffres", async () => {
    const res = await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: 'Résume ma situation financière.' })
      .expect(201);

    expect(res.body.reply).toBe('Réponse IA simulée.');
    expect(fakeGemini.lastCall?.message).toContain("Aucune source de revenus n'a encore été créée");
  });

  it('utilisateur avec uniquement des revenus : le contexte montre les revenus sans catégories de dépenses', async () => {
    const account = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'Salaire', category: 'salaire', currency: 'XOF', openingBalance: '0' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/transactions')
      .set(...authHeader(accessToken))
      .send({ accountId: account.body.id, type: 'income', amount: '450000', categoryId: incomeCategoryId })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: 'Comment gérer mes revenus ce mois-ci ?' })
      .expect(201);

    expect(res.body.reply).toBe('Réponse IA simulée.');
    expect(fakeGemini.lastCall?.message).toContain('Revenus : 450000.00');
    expect(fakeGemini.lastCall?.message).not.toContain('Principales catégories de dépenses');
  });

  it('utilisateur avec revenus et dépenses : le contexte inclut les deux et les catégories principales', async () => {
    const account = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'Compte mixte', category: 'salaire', currency: 'XOF', openingBalance: '0' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/transactions')
      .set(...authHeader(accessToken))
      .send({ accountId: account.body.id, type: 'expense', amount: '90000', categoryId: expenseCategoryId })
      .expect(201);

    await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: 'Où est-ce que je dépense le plus ?' })
      .expect(201);

    expect(fakeGemini.lastCall?.message).toContain('Principales catégories de dépenses');
    expect(fakeGemini.lastCall?.message).toContain('Alimentation : 90000.00');
  });

  it("utilisateur avec un objectif d'épargne : le contexte inclut sa progression", async () => {
    await request(app.getHttpServer())
      .post('/goals')
      .set(...authHeader(accessToken))
      .send({ name: "Fonds d'urgence", targetAmount: '500000' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: "Comment atteindre mon objectif d'épargne ?" })
      .expect(201);

    expect(fakeGemini.lastCall?.message).toContain("Objectifs d'épargne");
    expect(fakeGemini.lastCall?.message).toContain("Fonds d'urgence");
    expect(fakeGemini.lastCall?.message).toContain('500000.00');
  });

  it("beaucoup de transactions : le message envoyé reste un résumé agrégé, jamais l'historique brut", async () => {
    const account = await request(app.getHttpServer())
      .post('/accounts')
      .set(...authHeader(accessToken))
      .send({ name: 'Compte volumineux', category: 'commerce', currency: 'XOF', openingBalance: '0' })
      .expect(201);

    for (let i = 0; i < 30; i += 1) {
      await request(app.getHttpServer())
        .post('/transactions')
        .set(...authHeader(accessToken))
        .send({ accountId: account.body.id, type: 'expense', amount: '1000', categoryId: expenseCategoryId })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: 'Analyse mes finances.' })
      .expect(201);

    // Un résumé agrégé reste court même avec 30 transactions : pas de dump ligne par ligne.
    expect(fakeGemini.lastCall!.message.length).toBeLessThan(3000);
    expect((fakeGemini.lastCall!.message.match(/\n/g) ?? []).length).toBeLessThan(40);
  });

  it("utilisateur avec un autre pays : le contexte reflète le pays/la devise réels sans rien inventer", async () => {
    await request(app.getHttpServer())
      .patch('/auth/me')
      .set(...authHeader(accessToken))
      .send({ country: 'FR' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: 'Résume ma situation.' })
      .expect(201);

    expect(fakeGemini.lastCall?.message).toContain('Pays : France');
    expect(fakeGemini.lastCall?.message).toContain('Devise : €');

    await request(app.getHttpServer())
      .patch('/auth/me')
      .set(...authHeader(accessToken))
      .send({ country: null })
      .expect(200);
  });

  it('rejette un code pays inconnu au lieu de le stocker tel quel', async () => {
    await request(app.getHttpServer())
      .patch('/auth/me')
      .set(...authHeader(accessToken))
      .send({ country: 'ZZ' })
      .expect(400);
  });

  it('erreur API Gemini : renvoie 502 avec un message sûr, jamais le détail technique', async () => {
    fakeGemini.nextReply = () => {
      throw new AiProviderError();
    };

    const res = await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: 'Bonjour' })
      .expect(502);

    expect(res.body.message).toBe('Le service IA est temporairement indisponible. Réessayez dans un instant.');
  });

  it('réponse Gemini vide : renvoie 502 avec un message clair invitant à réessayer', async () => {
    fakeGemini.nextReply = () => {
      throw new AiEmptyResponseError();
    };

    const res = await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: 'Bonjour' })
      .expect(502);

    expect(res.body.message).toMatch(/n'a pas pu générer/);
  });

  it('GET /ai/summary construit automatiquement le prompt, sans que le client en fournisse un', async () => {
    const res = await request(app.getHttpServer())
      .get('/ai/summary')
      .set(...authHeader(accessToken))
      .expect(200);

    expect(res.body.reply).toBe('Réponse IA simulée.');
    expect(fakeGemini.lastCall?.message).toContain('Génère un résumé de ma situation financière');
  });

  it('rejette un message vide (validation DTO)', async () => {
    await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(accessToken))
      .send({ message: '' })
      .expect(400);
  });
});
