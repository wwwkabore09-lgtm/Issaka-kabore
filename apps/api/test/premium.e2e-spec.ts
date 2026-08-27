import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PAYMENT_PROVIDER, type CreatePaymentParams, type CreatePaymentResult, type PaymentProvider, type VerifiedPaymentEvent } from '../src/premium/payment-provider.interface';
import { authHeader, registerTestUser } from './utils/auth';

const WEBHOOK_SECRET = 'test-webhook-secret';

// Prestataire de test : implémente réellement l'interface PaymentProvider (signature HMAC,
// parsing d'événement) pour exercer pour de vrai le webhook/l'idempotence/le contrôle de
// montant du backend — jamais un appel réseau, jamais branché en dehors des tests. Le
// prestataire réellement branché en production reste UnconfiguredPaymentProvider tant
// qu'aucun prestataire réel n'est fourni (voir premium.module.ts).
class TestPaymentProvider implements PaymentProvider {
  readonly name = 'test-provider';
  configured = true;
  createPaymentImpl: (params: CreatePaymentParams) => Promise<CreatePaymentResult> = async (params) => ({
    providerTransactionId: `test-txn-${params.paymentId}`,
    checkoutUrl: `https://example.test/checkout/${params.paymentId}`,
    status: 'pending',
  });

  isConfigured(): boolean {
    return this.configured;
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    return this.createPaymentImpl(params);
  }

  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string>): boolean {
    const signature = headers['x-test-signature'];
    if (!signature) return false;
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
    return signature === expected;
  }

  parseWebhookEvent(rawBody: Buffer): VerifiedPaymentEvent {
    const body = JSON.parse(rawBody.toString('utf8'));
    return {
      paymentId: body.paymentId ?? null,
      providerTransactionId: body.providerTransactionId,
      status: body.status,
      amount: body.amount,
      currency: body.currency,
      raw: body,
    };
  }
}

function signedWebhookPayload(payload: Record<string, unknown>) {
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
  return { payload, signature };
}

describe('Premium/Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let provider: TestPaymentProvider;
  let userId: string;
  let accessToken: string;

  beforeAll(async () => {
    provider = new TestPaymentProvider();

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PAYMENT_PROVIDER)
      .useValue(provider)
      .compile();

    // rawBody: true — nécessaire pour que le controller webhook accède aux octets exacts
    // du corps de requête (req.rawBody), condition d'une vérification de signature HMAC
    // fiable (voir main.ts).
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const user = await registerTestUser(app, { email: `premium-e2e-${Date.now()}@finza.test`, fullName: 'Aminata Test' });
    userId = user.userId;
    accessToken = user.accessToken;
  });

  afterEach(() => {
    provider.configured = true;
    provider.createPaymentImpl = async (params) => ({
      providerTransactionId: `test-txn-${params.paymentId}`,
      checkoutUrl: `https://example.test/checkout/${params.paymentId}`,
      status: 'pending',
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { userId } });
    await prisma.premiumSubscription.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  function sendWebhook(payload: Record<string, unknown>) {
    const { payload: body, signature } = signedWebhookPayload(payload);
    return request(app.getHttpServer()).post('/payments/webhook').set('x-test-signature', signature).send(body);
  }

  // --- 1. Utilisateur gratuit ---
  it('1. utilisateur gratuit : aucun abonnement, isPremium=false, statut "none"', async () => {
    const res = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);

    expect(res.body).toMatchObject({ status: 'none', isPremium: false, plan: 'premium', price: '2000.00', currency: 'XOF' });
  });

  // --- 2 & 3. Clique sur Premium -> paiement en attente ---
  let firstPaymentId: string;

  it('2. utilisateur clique sur Premium : crée un paiement + un abonnement "pending", retourne une URL de paiement', async () => {
    const res = await request(app.getHttpServer())
      .post('/premium/subscribe')
      .set(...authHeader(accessToken))
      .expect(201);

    expect(res.body.payment.status).toBe('pending');
    expect(res.body.payment.amount).toBe('2000.00');
    expect(res.body.payment.currency).toBe('XOF');
    expect(res.body.checkoutUrl).toContain('https://example.test/checkout/');
    firstPaymentId = res.body.payment.id;

    const status = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);
    expect(status.body.status).toBe('pending');
    expect(status.body.isPremium).toBe(false);
  });

  it('3. paiement en attente : apparaît dans GET /premium/payments avec le statut pending', async () => {
    const res = await request(app.getHttpServer())
      .get('/premium/payments')
      .set(...authHeader(accessToken))
      .expect(200);

    const payment = res.body.find((p: { id: string }) => p.id === firstPaymentId);
    expect(payment).toMatchObject({ status: 'pending', amount: '2000.00', currency: 'XOF' });
  });

  // --- 4. Paiement réussi ---
  it("4. paiement réussi (webhook) : active l'abonnement Premium avec une date de fin à +1 mois", async () => {
    await sendWebhook({
      paymentId: firstPaymentId,
      providerTransactionId: `test-txn-${firstPaymentId}`,
      status: 'successful',
      amount: '2000.00',
      currency: 'XOF',
    }).expect(201);

    const status = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);

    expect(status.body.status).toBe('active');
    expect(status.body.isPremium).toBe(true);
    expect(status.body.startDate).toBeTruthy();
    expect(status.body.endDate).toBeTruthy();

    const start = new Date(status.body.startDate).getTime();
    const end = new Date(status.body.endDate).getTime();
    const approxOneMonthMs = 27 * 24 * 60 * 60 * 1000;
    expect(end - start).toBeGreaterThan(approxOneMonthMs);

    const payments = await request(app.getHttpServer())
      .get('/premium/payments')
      .set(...authHeader(accessToken))
      .expect(200);
    const payment = payments.body.find((p: { id: string }) => p.id === firstPaymentId);
    expect(payment.status).toBe('successful');
    expect(payment.completedAt).toBeTruthy();
  });

  // --- 7. Webhook reçu deux fois (idempotence) ---
  it('7. webhook reçu deux fois pour la même transaction : ne prolonge pas deux fois, ne crée rien en double', async () => {
    const before = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);

    await sendWebhook({
      paymentId: firstPaymentId,
      providerTransactionId: `test-txn-${firstPaymentId}`,
      status: 'successful',
      amount: '2000.00',
      currency: 'XOF',
    }).expect(201);

    const after = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);

    // La date de fin n'a pas bougé : le second webhook a été ignoré (paiement déjà "successful").
    expect(after.body.endDate).toBe(before.body.endDate);

    const subCount = await prisma.premiumSubscription.count({ where: { userId } });
    expect(subCount).toBe(1);
  });

  // --- Signature invalide ---
  it('rejette un webhook avec une signature invalide (jamais confiance aux données non vérifiées)', async () => {
    await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('x-test-signature', 'signature-bidon')
      .send({ paymentId: firstPaymentId, providerTransactionId: 'x', status: 'successful', amount: '2000.00', currency: 'XOF' })
      .expect(401);
  });

  // --- 8. Transaction inconnue ---
  it('8. webhook pour une transaction inconnue : rejeté, aucune donnée créée', async () => {
    await sendWebhook({
      paymentId: '00000000-0000-0000-0000-000000000000',
      providerTransactionId: 'inconnu',
      status: 'successful',
      amount: '2000.00',
      currency: 'XOF',
    }).expect(404);
  });

  // --- 9. Montant incorrect ---
  it('9. montant incorrect dans le webhook : paiement marqué en échec, abonnement jamais activé', async () => {
    const sub = await request(app.getHttpServer())
      .post('/premium/subscribe')
      .set(...authHeader(accessToken))
      .expect(201);
    const paymentId = sub.body.payment.id;

    await sendWebhook({
      paymentId,
      providerTransactionId: `test-txn-${paymentId}`,
      status: 'successful',
      amount: '1.00',
      currency: 'XOF',
    }).expect(422);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe('failed');
  });

  // --- 5. Paiement échoué ---
  it('5. paiement échoué (webhook status=failed) : reflété tel quel, aucune activation', async () => {
    const sub = await request(app.getHttpServer())
      .post('/premium/subscribe')
      .set(...authHeader(accessToken))
      .expect(201);
    const paymentId = sub.body.payment.id;

    await sendWebhook({ paymentId, providerTransactionId: `test-txn-${paymentId}`, status: 'failed', amount: '2000.00', currency: 'XOF' }).expect(201);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe('failed');
  });

  // --- 6. Paiement annulé ---
  it('6. paiement annulé (webhook status=cancelled) : reflété tel quel', async () => {
    const sub = await request(app.getHttpServer())
      .post('/premium/subscribe')
      .set(...authHeader(accessToken))
      .expect(201);
    const paymentId = sub.body.payment.id;

    await sendWebhook({ paymentId, providerTransactionId: `test-txn-${paymentId}`, status: 'cancelled', amount: '2000.00', currency: 'XOF' }).expect(
      201,
    );

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    expect(payment?.status).toBe('cancelled');
  });

  // --- 10. Utilisateur déjà Premium : renouvellement anticipé prolonge depuis endDate, pas depuis maintenant ---
  it("10. utilisateur déjà Premium qui repaie avant expiration : prolonge depuis la date de fin actuelle, aucun jour perdu", async () => {
    const before = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);
    expect(before.body.isPremium).toBe(true);

    const sub = await request(app.getHttpServer())
      .post('/premium/subscribe')
      .set(...authHeader(accessToken))
      .expect(201);
    const paymentId = sub.body.payment.id;

    await sendWebhook({ paymentId, providerTransactionId: `test-txn-${paymentId}`, status: 'successful', amount: '2000.00', currency: 'XOF' }).expect(
      201,
    );

    const after = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);

    const beforeEnd = new Date(before.body.endDate).getTime();
    const afterEnd = new Date(after.body.endDate).getTime();
    const approxOneMonthMs = 27 * 24 * 60 * 60 * 1000;
    // La nouvelle échéance part de l'ancienne, pas de "maintenant" : le gain est d'environ un
    // mois, jamais moins (ce qui trahirait une remise à zéro depuis la date du jour).
    expect(afterEnd - beforeEnd).toBeGreaterThan(approxOneMonthMs);
  });

  // --- Annuler le renouvellement : n'interrompt jamais l'accès en cours ---
  it("annuler le renouvellement automatique n'interrompt pas l'accès en cours (reste actif jusqu'à endDate)", async () => {
    const res = await request(app.getHttpServer())
      .patch('/premium/auto-renew')
      .set(...authHeader(accessToken))
      .send({ autoRenew: false })
      .expect(200);

    expect(res.body.autoRenew).toBe(false);
    expect(res.body.status).toBe('active');
    expect(res.body.isPremium).toBe(true);
  });

  // --- 11. Abonnement expiré (auto-guérison à la lecture) ---
  it('11. abonnement expiré : le statut passe automatiquement à "expired" (ou "cancelled" si le renouvellement était désactivé)', async () => {
    await prisma.premiumSubscription.update({
      where: { userId },
      data: { endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), autoRenew: false },
    });

    const res = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);

    // autoRenew était false au moment de l'expiration : "cancelled", pas "expired" — distingue
    // une expiration voulue d'un échec de renouvellement.
    expect(res.body.status).toBe('cancelled');
    expect(res.body.isPremium).toBe(false);

    const persisted = await prisma.premiumSubscription.findUnique({ where: { userId } });
    expect(persisted?.status).toBe('cancelled');
  });

  it('un abonnement expiré avec autoRenew=true devient "expired", pas "cancelled"', async () => {
    await prisma.premiumSubscription.update({
      where: { userId },
      data: { endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), autoRenew: true },
    });

    const res = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);

    expect(res.body.status).toBe('expired');
    expect(res.body.isPremium).toBe(false);
  });

  // --- 12. Renouvellement après expiration ---
  it('12. renouvellement après expiration : réactive Premium avec une nouvelle période complète', async () => {
    const sub = await request(app.getHttpServer())
      .post('/premium/subscribe')
      .set(...authHeader(accessToken))
      .expect(201);
    const paymentId = sub.body.payment.id;

    await sendWebhook({ paymentId, providerTransactionId: `test-txn-${paymentId}`, status: 'successful', amount: '2000.00', currency: 'XOF' }).expect(
      201,
    );

    const res = await request(app.getHttpServer())
      .get('/premium/status')
      .set(...authHeader(accessToken))
      .expect(200);

    expect(res.body.status).toBe('active');
    expect(res.body.isPremium).toBe(true);
    expect(res.body.autoRenew).toBe(true);
  });

  // --- 13. Accès direct à une fonctionnalité Premium sans abonnement ---
  it("13. accès direct à une route Premium sans abonnement actif : refusé côté serveur (403)", async () => {
    const freeUser = await registerTestUser(app, { email: `premium-free-e2e-${Date.now()}@finza.test`, fullName: 'Sans abonnement' });

    await request(app.getHttpServer())
      .post('/ai/advice')
      .set(...authHeader(freeUser.accessToken))
      .send({ message: 'Bonjour' })
      .expect(403);

    await prisma.user.delete({ where: { id: freeUser.userId } });
  });

  // --- 14 & 15. Erreur / indisponibilité du fournisseur au moment de créer le paiement ---
  it('14. erreur du fournisseur de paiement à la création : 502, aucun paiement fantôme en "pending"', async () => {
    provider.createPaymentImpl = async () => {
      throw new Error('Panne simulée du prestataire');
    };

    const res = await request(app.getHttpServer())
      .post('/premium/subscribe')
      .set(...authHeader(accessToken))
      .expect(502);

    expect(res.body.message).toMatch(/temporairement indisponible/);

    // Le paiement créé avant l'appel au prestataire est bien marqué en échec, jamais laissé
    // "pending" indéfiniment.
    const orphaned = await prisma.payment.findFirst({ where: { userId, status: 'pending' }, orderBy: { createdAt: 'desc' } });
    expect(orphaned).toBeNull();
  });

  it("15. prestataire non configuré : 503 avec un message clair, jamais de détail technique ni de fausse passerelle", async () => {
    provider.configured = false;

    const res = await request(app.getHttpServer())
      .post('/premium/subscribe')
      .set(...authHeader(accessToken))
      .expect(503);

    expect(res.body.message).toBe("Le paiement en ligne n'est pas encore configuré.");
  });

  // --- Administration ---
  it('les statistiques admin sont refusées à un utilisateur non-admin', async () => {
    await request(app.getHttpServer())
      .get('/admin/premium/stats')
      .set(...authHeader(accessToken))
      .expect(403);
  });

  it('les statistiques admin reflètent les paiements et abonnements réels une fois le rôle accordé', async () => {
    await prisma.user.update({ where: { id: userId }, data: { isAdmin: true } });

    const stats = await request(app.getHttpServer())
      .get('/admin/premium/stats')
      .set(...authHeader(accessToken))
      .expect(200);

    expect(stats.body.currency).toBe('XOF');
    expect(stats.body.successfulPaymentsCount).toBeGreaterThanOrEqual(1);
    expect(Number(stats.body.totalRevenue)).toBeGreaterThanOrEqual(2000);

    const transactions = await request(app.getHttpServer())
      .get('/admin/premium/transactions')
      .set(...authHeader(accessToken))
      .expect(200);
    expect(Array.isArray(transactions.body)).toBe(true);
    expect(transactions.body.some((p: { userId: string }) => p.userId === userId)).toBe(true);

    await prisma.user.update({ where: { id: userId }, data: { isAdmin: false } });
  });
});
