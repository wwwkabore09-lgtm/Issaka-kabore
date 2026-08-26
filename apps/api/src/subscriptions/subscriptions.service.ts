import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BillingFrequency, SubscriptionDto, SubscriptionsSummaryDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Ramène un montant facturé à une fréquence donnée à son équivalent mensuel, pour pouvoir
// comparer/additionner des abonnements de fréquences différentes.
function toMonthlyEquivalent(amount: Prisma.Decimal, frequency: BillingFrequency): Prisma.Decimal {
  switch (frequency) {
    case 'weekly':
      return amount.mul(52).div(12);
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount.div(3);
    case 'yearly':
      return amount.div(12);
  }
}

// Avance une date d'un cycle de facturation. Utilise l'arithmétique native de Date pour
// mois/années : un débordement de fin de mois (ex: 31 janvier + 1 mois) est normalisé par
// JS vers le mois suivant, comportement standard accepté pour ce MVP.
function advanceByOneCycle(date: Date, frequency: BillingFrequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  async create(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionDto> {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('amount doit être strictement positif');
    }

    if (dto.accountId) {
      await this.accountsService.getOwnedAccountOrThrow(dto.accountId, userId);
    }

    if (dto.categoryId) {
      await this.getOwnedExpenseCategoryOrThrow(dto.categoryId, userId);
    }

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        name: dto.name,
        amount,
        billingFrequency: dto.billingFrequency,
        nextBillingDate: new Date(dto.nextBillingDate),
      },
    });

    return this.toDto(subscription);
  }

  async findAllForUser(userId: string, activeOnly?: boolean): Promise<SubscriptionDto[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: { nextBillingDate: 'asc' },
    });

    return subscriptions.map((s) => this.toDto(s));
  }

  async findOneForUser(id: string, userId: string): Promise<SubscriptionDto> {
    const subscription = await this.getOwnedSubscriptionOrThrow(id, userId);
    return this.toDto(subscription);
  }

  // Somme des coûts mensuels équivalents des abonnements actifs : la dépense récurrente
  // totale, comparable d'un mois à l'autre même si les fréquences de facturation diffèrent.
  async getSummary(userId: string): Promise<SubscriptionsSummaryDto> {
    const active = await this.prisma.subscription.findMany({ where: { userId, isActive: true } });

    const total = active.reduce(
      (sum, s) => sum.add(toMonthlyEquivalent(s.amount, s.billingFrequency as BillingFrequency)),
      new Prisma.Decimal(0),
    );

    return { activeCount: active.length, totalMonthlyRecurring: total.toFixed(2) };
  }

  async update(id: string, userId: string, dto: UpdateSubscriptionDto): Promise<SubscriptionDto> {
    await this.getOwnedSubscriptionOrThrow(id, userId);

    const data: Prisma.SubscriptionUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.billingFrequency !== undefined) data.billingFrequency = dto.billingFrequency;
    if (dto.nextBillingDate !== undefined) data.nextBillingDate = new Date(dto.nextBillingDate);
    if (dto.categoryId !== undefined) {
      await this.getOwnedExpenseCategoryOrThrow(dto.categoryId, userId);
      data.category = { connect: { id: dto.categoryId } };
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.amount !== undefined) {
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.lte(0)) {
        throw new BadRequestException('amount doit être strictement positif');
      }
      data.amount = amount;
    }

    const updated = await this.prisma.subscription.update({ where: { id }, data });
    return this.toDto(updated);
  }

  // Fait avancer l'échéance d'un cycle de facturation (ex: après avoir constaté le
  // prélèvement). N'enregistre aucune transaction : ce domaine ne fait que suivre les
  // échéances, il ne bouge pas d'argent (voir le domaine Transactions pour ça).
  async renew(id: string, userId: string): Promise<SubscriptionDto> {
    const subscription = await this.getOwnedSubscriptionOrThrow(id, userId);

    const nextBillingDate = advanceByOneCycle(
      subscription.nextBillingDate,
      subscription.billingFrequency as BillingFrequency,
    );

    const updated = await this.prisma.subscription.update({ where: { id }, data: { nextBillingDate } });
    return this.toDto(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOwnedSubscriptionOrThrow(id, userId);
    await this.prisma.subscription.delete({ where: { id } });
  }

  private async getOwnedExpenseCategoryOrThrow(categoryId: string, userId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });

    if (!category || (category.userId !== null && category.userId !== userId)) {
      throw new NotFoundException('Catégorie introuvable');
    }
    if (category.kind !== 'expense') {
      throw new BadRequestException('Un abonnement ne peut être classé que dans une catégorie de dépense');
    }
  }

  private async getOwnedSubscriptionOrThrow(id: string, userId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });

    if (!subscription || subscription.userId !== userId) {
      // 404 (jamais 403) : ne jamais révéler qu'un abonnement existe à qui n'y a pas droit.
      throw new NotFoundException('Abonnement introuvable');
    }

    return subscription;
  }

  private toDto(subscription: {
    id: string;
    userId: string;
    accountId: string | null;
    categoryId: string | null;
    name: string;
    amount: Prisma.Decimal;
    billingFrequency: string;
    nextBillingDate: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionDto {
    const frequency = subscription.billingFrequency as BillingFrequency;
    const daysUntilNextBilling = Math.ceil(
      (subscription.nextBillingDate.getTime() - Date.now()) / MS_PER_DAY,
    );

    return {
      id: subscription.id,
      userId: subscription.userId,
      accountId: subscription.accountId,
      categoryId: subscription.categoryId,
      name: subscription.name,
      amount: subscription.amount.toFixed(2),
      billingFrequency: frequency,
      nextBillingDate: subscription.nextBillingDate.toISOString(),
      isActive: subscription.isActive,
      monthlyEquivalent: toMonthlyEquivalent(subscription.amount, frequency).toFixed(2),
      daysUntilNextBilling,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }
}
