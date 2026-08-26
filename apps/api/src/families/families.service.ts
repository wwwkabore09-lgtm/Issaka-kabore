import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { FamilyDto, SharedAccountDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class FamiliesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFamilyDto): Promise<FamilyDto> {
    const existing = await this.prisma.familyMember.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Vous appartenez déjà à une famille');
    }

    const family = await this.prisma.family.create({
      data: {
        name: dto.name,
        ownerId: userId,
        members: {
          create: { userId, role: 'owner' },
        },
      },
      include: { members: { include: { user: true } } },
    });

    return this.toDto(family);
  }

  // Tableau vide (pas une erreur) quand l'utilisateur n'appartient à aucune famille — même
  // convention que les autres domaines (GET /accounts, /goals, ... retournent [] plutôt
  // qu'un 404 quand il n'y a rien). Au plus un élément dans ce MVP (une famille par
  // utilisateur), mais garde la forme tableau pour rester cohérent.
  async findAllForUser(userId: string): Promise<FamilyDto[]> {
    const membership = await this.prisma.familyMember.findUnique({ where: { userId } });
    if (!membership) return [];

    const family = await this.prisma.family.findUniqueOrThrow({
      where: { id: membership.familyId },
      include: { members: { include: { user: true } } },
    });

    return [this.toDto(family)];
  }

  async addMember(familyId: string, requestingUserId: string, dto: AddMemberDto): Promise<FamilyDto> {
    const family = await this.getOwnedFamilyOrThrow(familyId, requestingUserId);

    const alreadyMember = await this.prisma.familyMember.findUnique({ where: { userId: dto.memberUserId } });
    if (alreadyMember) {
      throw new ConflictException('Cet utilisateur appartient déjà à une famille');
    }

    await this.prisma.familyMember.create({
      data: { familyId: family.id, userId: dto.memberUserId, role: 'member' },
    });

    const updated = await this.prisma.family.findUniqueOrThrow({
      where: { id: family.id },
      include: { members: { include: { user: true } } },
    });

    return this.toDto(updated);
  }

  // Le propriétaire peut retirer n'importe quel membre ; un membre peut se retirer
  // lui-même. Le propriétaire ne peut pas se retirer par cette voie (voir remove()).
  async removeMember(familyId: string, memberUserId: string, requestingUserId: string): Promise<void> {
    const family = await this.getFamilyOrThrow(familyId);

    const isOwner = family.ownerId === requestingUserId;
    const isSelf = requestingUserId === memberUserId;
    if (!isOwner && !isSelf) {
      throw new NotFoundException('Famille introuvable');
    }

    if (memberUserId === family.ownerId) {
      throw new BadRequestException(
        'Le propriétaire ne peut pas quitter la famille — supprimez la famille à la place',
      );
    }

    const member = await this.prisma.familyMember.findUnique({ where: { userId: memberUserId } });
    if (!member || member.familyId !== familyId) {
      throw new NotFoundException('Membre introuvable dans cette famille');
    }

    await this.prisma.familyMember.delete({ where: { userId: memberUserId } });
  }

  async remove(familyId: string, userId: string): Promise<void> {
    await this.getOwnedFamilyOrThrow(familyId, userId);
    await this.prisma.family.delete({ where: { id: familyId } });
  }

  // Comptes partagés par n'importe quel membre de la famille (soi-même inclus) : jamais
  // les transactions/budgets/objectifs, seulement nom/devise/solde — et uniquement les
  // comptes explicitement marqués isSharedWithFamily.
  async getSharedAccounts(familyId: string, userId: string): Promise<SharedAccountDto[]> {
    const family = await this.getFamilyOrThrow(familyId);

    const isMember = family.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new NotFoundException('Famille introuvable');
    }

    const accounts = await this.prisma.account.findMany({
      where: {
        isSharedWithFamily: true,
        userId: { in: family.members.map((m) => m.userId) },
      },
      include: { user: true },
      orderBy: { name: 'asc' },
    });

    return accounts.map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      currentBalance: account.currentBalance.toFixed(2),
      ownerUserId: account.userId,
      ownerName: account.user.fullName,
    }));
  }

  private async getFamilyOrThrow(familyId: string) {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: { members: true },
    });

    if (!family) {
      throw new NotFoundException('Famille introuvable');
    }

    return family;
  }

  private async getOwnedFamilyOrThrow(familyId: string, userId: string) {
    const family = await this.getFamilyOrThrow(familyId);

    // 404 (jamais 403) : ne jamais révéler qu'une famille existe à qui n'y a pas droit.
    if (family.ownerId !== userId) {
      throw new NotFoundException('Famille introuvable');
    }

    return family;
  }

  private toDto(family: {
    id: string;
    name: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
    members: { userId: string; role: string; joinedAt: Date; user: { fullName: string; email: string } }[];
  }): FamilyDto {
    return {
      id: family.id,
      name: family.name,
      ownerId: family.ownerId,
      createdAt: family.createdAt.toISOString(),
      updatedAt: family.updatedAt.toISOString(),
      members: family.members.map((m) => ({
        userId: m.userId,
        fullName: m.user.fullName,
        email: m.user.email,
        role: m.role as FamilyDto['members'][number]['role'],
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }
}
