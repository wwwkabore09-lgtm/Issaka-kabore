import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DebtDirection, DebtDto, DebtPaymentDto, DebtProgressDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  async create(dto: CreateDebtDto): Promise<DebtDto> {
    const principalAmount = new Prisma.Decimal(dto.principalAmount);
    if (principalAmount.lte(0)) {
      throw new BadRequestException('principalAmount doit être strictement positif');
    }

    if (dto.accountId) {
      await this.accountsService.getOwnedAccountOrThrow(dto.accountId, dto.userId);
    }

    const debt = await this.prisma.debt.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        counterpartyName: dto.counterpartyName,
        accountId: dto.accountId,
        principalAmount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        description: dto.description,
      },
    });

    return this.toDto(debt);
  }

  async findAllForUser(userId: string, type?: DebtDirection): Promise<DebtProgressDto[]> {
    const debts = await this.prisma.debt.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'asc' },
    });

    if (debts.length === 0) return [];

    const sums = await this.prisma.debtPayment.groupBy({
      by: ['debtId'],
      where: { debtId: { in: debts.map((d) => d.id) } },
      _sum: { amount: true },
    });
    const sumMap = new Map(sums.map((s) => [s.debtId, s._sum.amount ?? new Prisma.Decimal(0)]));

    return debts.map((debt) => this.toProgressDto(debt, sumMap.get(debt.id) ?? new Prisma.Decimal(0)));
  }

  async findOneForUser(id: string, userId: string): Promise<DebtProgressDto> {
    const debt = await this.getOwnedDebtOrThrow(id, userId);

    const result = await this.prisma.debtPayment.aggregate({
      where: { debtId: id },
      _sum: { amount: true },
    });

    return this.toProgressDto(debt, result._sum.amount ?? new Prisma.Decimal(0));
  }

  async listPayments(debtId: string, userId: string): Promise<DebtPaymentDto[]> {
    await this.getOwnedDebtOrThrow(debtId, userId);

    const payments = await this.prisma.debtPayment.findMany({
      where: { debtId },
      orderBy: { paidAt: 'desc' },
    });

    return payments.map((p) => this.toPaymentDto(p));
  }

  async addPayment(debtId: string, dto: CreatePaymentDto): Promise<DebtPaymentDto> {
    await this.getOwnedDebtOrThrow(debtId, dto.userId);

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('amount doit être strictement positif');
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (paidAt.getTime() > Date.now()) {
      throw new BadRequestException('paidAt ne peut pas être dans le futur');
    }

    const payment = await this.prisma.debtPayment.create({
      data: { debtId, amount, note: dto.note, paidAt },
    });

    return this.toPaymentDto(payment);
  }

  async update(id: string, userId: string, dto: UpdateDebtDto): Promise<DebtDto> {
    await this.getOwnedDebtOrThrow(id, userId);

    const data: Prisma.DebtUpdateInput = {};

    if (dto.counterpartyName !== undefined) {
      data.counterpartyName = dto.counterpartyName;
    }
    if (dto.principalAmount !== undefined) {
      const principalAmount = new Prisma.Decimal(dto.principalAmount);
      if (principalAmount.lte(0)) {
        throw new BadRequestException('principalAmount doit être strictement positif');
      }
      data.principalAmount = principalAmount;
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = new Date(dto.dueDate);
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }

    const updated = await this.prisma.debt.update({ where: { id }, data });
    return this.toDto(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.getOwnedDebtOrThrow(id, userId);
    await this.prisma.debt.delete({ where: { id } });
  }

  private async getOwnedDebtOrThrow(id: string, userId: string) {
    const debt = await this.prisma.debt.findUnique({ where: { id } });

    if (!debt || debt.userId !== userId) {
      // 404 (jamais 403) : ne jamais révéler qu'une dette/créance existe à qui n'y a pas droit.
      throw new NotFoundException('Dette ou créance introuvable');
    }

    return debt;
  }

  private toDto(debt: {
    id: string;
    userId: string;
    type: string;
    counterpartyName: string;
    accountId: string | null;
    principalAmount: Prisma.Decimal;
    dueDate: Date | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DebtDto {
    return {
      id: debt.id,
      userId: debt.userId,
      type: debt.type as DebtDto['type'],
      counterpartyName: debt.counterpartyName,
      accountId: debt.accountId,
      principalAmount: debt.principalAmount.toFixed(2),
      dueDate: debt.dueDate ? debt.dueDate.toISOString() : null,
      description: debt.description,
      createdAt: debt.createdAt.toISOString(),
      updatedAt: debt.updatedAt.toISOString(),
    };
  }

  private toProgressDto(
    debt: {
      id: string;
      type: string;
      counterpartyName: string;
      accountId: string | null;
      principalAmount: Prisma.Decimal;
      dueDate: Date | null;
    },
    paidAmount: Prisma.Decimal,
  ): DebtProgressDto {
    const remaining = debt.principalAmount.sub(paidAmount);
    const percentage = debt.principalAmount.gt(0) ? paidAmount.div(debt.principalAmount).mul(100).toNumber() : 0;

    return {
      debtId: debt.id,
      type: debt.type as DebtProgressDto['type'],
      counterpartyName: debt.counterpartyName,
      accountId: debt.accountId,
      principalAmount: debt.principalAmount.toFixed(2),
      dueDate: debt.dueDate ? debt.dueDate.toISOString() : null,
      paidAmount: paidAmount.toFixed(2),
      remaining: remaining.toFixed(2),
      percentage: Math.round(percentage * 10) / 10,
      isSettled: paidAmount.gte(debt.principalAmount),
    };
  }

  private toPaymentDto(payment: {
    id: string;
    debtId: string;
    amount: Prisma.Decimal;
    note: string | null;
    paidAt: Date;
    createdAt: Date;
  }): DebtPaymentDto {
    return {
      id: payment.id,
      debtId: payment.debtId,
      amount: payment.amount.toFixed(2),
      note: payment.note,
      paidAt: payment.paidAt.toISOString(),
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
