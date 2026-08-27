import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PREMIUM_CURRENCY, PREMIUM_PLAN, PREMIUM_PRICE, type PremiumSubscriptionDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';

type PremiumStatusValue = 'pending' | 'active' | 'expired' | 'cancelled';

interface SubscriptionRow {
  plan: string;
  price: Prisma.Decimal;
  currency: string;
  status: PremiumStatusValue;
  startDate: Date | null;
  endDate: Date | null;
  autoRenew: boolean;
}

// Un mois calendaire, pas 30 jours fixes : un paiement le 31 janvier expire fin février, pas
// à une date arbitraire à ±1-2 jours du renouvellement habituel de l'utilisateur.
function addOneMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

@Injectable()
export class PremiumService {
  constructor(private readonly prisma: PrismaService) {}

  // Seule fonction qui décide du statut — jamais une valeur lue telle quelle en base sans
  // repasser par ici, pour ne jamais servir un statut "active" périmé (voir section
  // "Expiration" du cahier des charges : la transition doit être automatique).
  private deriveStatus(sub: Pick<SubscriptionRow, 'status' | 'endDate' | 'autoRenew'>): PremiumStatusValue {
    if (sub.status === 'pending') return 'pending';
    const stillWithinPeriod = sub.endDate !== null && sub.endDate.getTime() > Date.now();
    if (stillWithinPeriod) return 'active';
    // La période est passée (ou n'a jamais commencé) : distingue "expiré" (un renouvellement
    // était attendu mais n'a pas abouti) de "annulé" (l'utilisateur avait désactivé le
    // renouvellement lui-même avant l'échéance).
    return sub.autoRenew ? 'expired' : 'cancelled';
  }

  // Lecture centrale de la fraîcheur du statut : si la base dit encore "active" alors que la
  // date est dépassée, on corrige la ligne ici (auto-guérison) plutôt que de dépendre d'une
  // tâche planifiée qui n'existe pas encore dans ce projet.
  private async loadAndHeal(userId: string) {
    const sub = await this.prisma.premiumSubscription.findUnique({ where: { userId } });
    if (!sub) return null;

    const derived = this.deriveStatus(sub);
    if (derived !== sub.status && sub.status !== 'pending') {
      return this.prisma.premiumSubscription.update({ where: { userId }, data: { status: derived } });
    }
    return sub;
  }

  async isPremium(userId: string): Promise<boolean> {
    const sub = await this.loadAndHeal(userId);
    return sub?.status === 'active';
  }

  async getSubscription(userId: string): Promise<PremiumSubscriptionDto> {
    const sub = await this.loadAndHeal(userId);
    if (!sub) {
      return {
        plan: PREMIUM_PLAN,
        price: PREMIUM_PRICE,
        currency: PREMIUM_CURRENCY,
        status: 'none',
        isPremium: false,
        startDate: null,
        endDate: null,
        autoRenew: true,
      };
    }
    return this.toDto(sub);
  }

  async setAutoRenew(userId: string, autoRenew: boolean): Promise<PremiumSubscriptionDto> {
    const sub = await this.prisma.premiumSubscription.update({ where: { userId }, data: { autoRenew } });
    return this.toDto({ ...sub, status: this.deriveStatus(sub) });
  }

  // Crée la ligne d'abonnement si elle n'existe pas encore (première souscription), sans
  // toucher à son statut/dates tant que le paiement n'a pas réellement abouti.
  async ensurePendingSubscription(userId: string): Promise<void> {
    await this.prisma.premiumSubscription.upsert({
      where: { userId },
      create: { userId, plan: PREMIUM_PLAN, price: new Prisma.Decimal(PREMIUM_PRICE), currency: PREMIUM_CURRENCY, status: 'pending' },
      update: {},
    });
  }

  // Appelé uniquement après confirmation serveur d'un paiement réussi (jamais depuis une
  // route atteignable par le frontend). Un renouvellement avant expiration prolonge depuis
  // la date de fin actuelle (aucun jour perdu) ; sinon la nouvelle période part de maintenant.
  async activateOrRenew(userId: string): Promise<void> {
    const existing = await this.prisma.premiumSubscription.findUnique({ where: { userId } });
    const now = new Date();
    const currentlyActive = existing?.endDate && existing.endDate.getTime() > now.getTime();
    const cycleStart = currentlyActive ? existing!.endDate! : now;

    await this.prisma.premiumSubscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: PREMIUM_PLAN,
        price: new Prisma.Decimal(PREMIUM_PRICE),
        currency: PREMIUM_CURRENCY,
        status: 'active',
        startDate: now,
        endDate: addOneMonth(now),
        autoRenew: true,
      },
      update: {
        status: 'active',
        startDate: existing?.startDate ?? now,
        endDate: addOneMonth(cycleStart),
        // Payer de nouveau réactive explicitement le renouvellement automatique, même s'il
        // avait été désactivé — l'utilisateur vient de manifester son intention de continuer.
        autoRenew: true,
      },
    });
  }

  // Un remboursement retire l'accès Premium immédiatement plutôt que d'attendre l'expiration
  // naturelle — l'argent a été rendu, l'accès ne doit pas rester acquis.
  async revokeForRefund(userId: string): Promise<void> {
    const sub = await this.prisma.premiumSubscription.findUnique({ where: { userId } });
    if (!sub) return;
    await this.prisma.premiumSubscription.update({
      where: { userId },
      data: { status: 'cancelled', autoRenew: false, endDate: new Date() },
    });
  }

  private toDto(sub: SubscriptionRow): PremiumSubscriptionDto {
    return {
      plan: sub.plan,
      price: sub.price.toFixed(2),
      currency: sub.currency,
      status: sub.status,
      isPremium: sub.status === 'active',
      startDate: sub.startDate ? sub.startDate.toISOString() : null,
      endDate: sub.endDate ? sub.endDate.toISOString() : null,
      autoRenew: sub.autoRenew,
    };
  }
}
