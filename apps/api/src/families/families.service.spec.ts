import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FamiliesService } from './families.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FamiliesService', () => {
  let service: FamiliesService;
  let prisma: {
    familyMember: { findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
    family: { create: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; delete: jest.Mock };
    account: { findMany: jest.Mock };
  };

  const ownerId = '11111111-1111-1111-1111-111111111111';
  const memberId = '22222222-2222-2222-2222-222222222222';
  const outsiderId = '33333333-3333-3333-3333-333333333333';
  const familyId = '44444444-4444-4444-4444-444444444444';

  const ownerUser = { fullName: 'Owner', email: 'owner@finza.test' };
  const memberUser = { fullName: 'Member', email: 'member@finza.test' };

  const familyWithMembers = {
    id: familyId,
    name: 'Famille Test',
    ownerId,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    members: [
      { userId: ownerId, familyId, role: 'owner', joinedAt: new Date('2026-01-01T00:00:00.000Z'), user: ownerUser },
      { userId: memberId, familyId, role: 'member', joinedAt: new Date('2026-01-02T00:00:00.000Z'), user: memberUser },
    ],
  };

  beforeEach(() => {
    prisma = {
      familyMember: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      family: { create: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), delete: jest.fn() },
      account: { findMany: jest.fn() },
    };

    service = new FamiliesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it("rejette la création si l'utilisateur appartient déjà à une famille", async () => {
      prisma.familyMember.findUnique.mockResolvedValue({ userId: ownerId, familyId: 'autre-famille' });

      await expect(service.create(ownerId, { name: 'Ma famille' })).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.family.create).not.toHaveBeenCalled();
    });

    it('crée la famille avec le créateur comme propriétaire', async () => {
      prisma.familyMember.findUnique.mockResolvedValue(null);
      prisma.family.create.mockResolvedValue({
        ...familyWithMembers,
        members: [familyWithMembers.members[0]],
      });

      const result = await service.create(ownerId, { name: 'Ma famille' });

      expect(result.ownerId).toBe(ownerId);
      expect(result.members).toHaveLength(1);
      expect(result.members[0].role).toBe('owner');
    });
  });

  describe('findAllForUser', () => {
    it("retourne un tableau vide (pas une erreur) quand l'utilisateur n'a pas de famille", async () => {
      prisma.familyMember.findUnique.mockResolvedValue(null);

      const result = await service.findAllForUser(outsiderId);

      expect(result).toEqual([]);
    });

    it('retourne la famille avec ses membres', async () => {
      prisma.familyMember.findUnique.mockResolvedValue({ userId: ownerId, familyId });
      prisma.family.findUniqueOrThrow.mockResolvedValue(familyWithMembers);

      const result = await service.findAllForUser(ownerId);

      expect(result).toHaveLength(1);
      expect(result[0].members).toHaveLength(2);
    });
  });

  describe('addMember', () => {
    it("rejette l'ajout par quelqu'un qui n'est pas propriétaire (404, pas 403)", async () => {
      prisma.family.findUnique.mockResolvedValue(familyWithMembers);

      await expect(
        service.addMember(familyId, memberId, { memberUserId: outsiderId }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.familyMember.create).not.toHaveBeenCalled();
    });

    it('rejette un utilisateur déjà membre d\'une autre famille', async () => {
      prisma.family.findUnique.mockResolvedValue(familyWithMembers);
      prisma.familyMember.findUnique.mockResolvedValue({ userId: outsiderId, familyId: 'autre-famille' });

      await expect(
        service.addMember(familyId, ownerId, { memberUserId: outsiderId }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('ajoute le membre quand la requête vient du propriétaire', async () => {
      prisma.family.findUnique.mockResolvedValue(familyWithMembers);
      prisma.familyMember.findUnique.mockResolvedValue(null);
      prisma.family.findUniqueOrThrow.mockResolvedValue(familyWithMembers);

      const result = await service.addMember(familyId, ownerId, { memberUserId: outsiderId });

      expect(prisma.familyMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: outsiderId, role: 'member' }) }),
      );
      expect(result.members).toHaveLength(2);
    });
  });

  describe('removeMember', () => {
    it('permet à un membre de se retirer lui-même', async () => {
      prisma.family.findUnique.mockResolvedValue(familyWithMembers);
      prisma.familyMember.findUnique.mockResolvedValue({ userId: memberId, familyId });

      await service.removeMember(familyId, memberId, memberId);

      expect(prisma.familyMember.delete).toHaveBeenCalledWith({ where: { userId: memberId } });
    });

    it("empêche de retirer quelqu'un d'autre que soi-même sans être propriétaire", async () => {
      prisma.family.findUnique.mockResolvedValue(familyWithMembers);

      await expect(service.removeMember(familyId, memberId, outsiderId)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.familyMember.delete).not.toHaveBeenCalled();
    });

    it('empêche le propriétaire de se retirer via cette méthode', async () => {
      prisma.family.findUnique.mockResolvedValue(familyWithMembers);

      await expect(service.removeMember(familyId, ownerId, ownerId)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.familyMember.delete).not.toHaveBeenCalled();
    });
  });

  describe('getSharedAccounts', () => {
    it("rejette un utilisateur qui n'est pas membre de la famille (404, pas 403)", async () => {
      prisma.family.findUnique.mockResolvedValue(familyWithMembers);

      await expect(service.getSharedAccounts(familyId, outsiderId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retourne uniquement les comptes marqués isSharedWithFamily, avec le nom du propriétaire', async () => {
      prisma.family.findUnique.mockResolvedValue(familyWithMembers);
      prisma.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Compte partagé',
          currency: 'XOF',
          currentBalance: { toFixed: () => '25000.00' },
          userId: memberId,
          user: { fullName: 'Member' },
        },
      ]);

      const result = await service.getSharedAccounts(familyId, ownerId);

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isSharedWithFamily: true, userId: { in: [ownerId, memberId] } },
        }),
      );
      expect(result).toEqual([
        { id: 'acc-1', name: 'Compte partagé', currency: 'XOF', currentBalance: '25000.00', ownerUserId: memberId, ownerName: 'Member' },
      ]);
    });
  });
});
