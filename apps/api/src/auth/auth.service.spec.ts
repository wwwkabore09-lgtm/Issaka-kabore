import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; findUniqueOrThrow: jest.Mock };
    refreshToken: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };
  let jwtService: { signAsync: jest.Mock };
  let configService: { get: jest.Mock };

  const userId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() },
      refreshToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.access.token') };
    configService = {
      get: jest.fn((key: string, fallback?: string) => fallback),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('hache le mot de passe et ne le stocke jamais en clair', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: userId, email: data.email, fullName: data.fullName, passwordHash: data.passwordHash }),
      );

      await service.register({ email: 'test@finza.test', password: 'motdepasse123', fullName: 'Test User' });

      const storedHash = prisma.user.create.mock.calls[0][0].data.passwordHash;
      expect(storedHash).not.toBe('motdepasse123');
      expect(await bcrypt.compare('motdepasse123', storedHash)).toBe(true);
    });

    it('rejette un email déjà utilisé (409)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId, email: 'test@finza.test' });

      await expect(
        service.register({ email: 'test@finza.test', password: 'motdepasse123', fullName: 'Test User' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('retourne des tokens et ne renvoie jamais passwordHash dans la réponse', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: userId,
        email: 'test@finza.test',
        fullName: 'Test User',
        passwordHash: 'hash-secret',
      });

      const result = await service.register({ email: 'test@finza.test', password: 'motdepasse123', fullName: 'Test User' });

      expect(result.user).toEqual({ id: userId, email: 'test@finza.test', fullName: 'Test User' });
      expect(JSON.stringify(result)).not.toContain('hash-secret');
      expect(result.tokens.accessToken).toBe('signed.access.token');
      expect(typeof result.tokens.refreshToken).toBe('string');
    });
  });

  describe('login', () => {
    it('rejette un email inconnu avec un message générique', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'inconnu@finza.test', password: 'peu importe' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejette un mot de passe incorrect avec le même message générique', async () => {
      const hash = await bcrypt.hash('bon-mot-de-passe', 4);
      prisma.user.findUnique.mockResolvedValue({ id: userId, email: 'test@finza.test', passwordHash: hash });

      await expect(service.login({ email: 'test@finza.test', password: 'mauvais' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejette un utilisateur sans mot de passe défini (créé avant le domaine auth)", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId, email: 'test@finza.test', passwordHash: null });

      await expect(service.login({ email: 'test@finza.test', password: 'quoi que ce soit' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('connecte avec le bon mot de passe', async () => {
      const hash = await bcrypt.hash('bon-mot-de-passe', 4);
      prisma.user.findUnique.mockResolvedValue({ id: userId, email: 'test@finza.test', fullName: 'Test', passwordHash: hash });

      const result = await service.login({ email: 'test@finza.test', password: 'bon-mot-de-passe' });

      expect(result.user.id).toBe(userId);
    });
  });

  describe('refresh', () => {
    it('rejette un jeton inconnu', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('token-inconnu')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejette un jeton révoqué', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.refresh('token-revoque')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejette un jeton expiré', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('token-expire')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("révoque l'ancien jeton et en émet un nouveau (rotation)", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      const result = await service.refresh('token-valide');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1' }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('signed.access.token');
    });
  });

  describe('logout', () => {
    it('révoque uniquement les jetons non déjà révoqués (idempotent)', async () => {
      await service.logout('un-jeton');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ revokedAt: null }),
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
