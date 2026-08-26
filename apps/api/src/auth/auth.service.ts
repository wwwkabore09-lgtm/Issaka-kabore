import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import type { AuthResponseDto, AuthTokensDto, AuthUserDto } from '@finza/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_BYTES = 40;

// Parse une durée façon "15m" / "30d" (utilisée par JWT_REFRESH_EXPIRES_IN) en millisecondes.
// Pas besoin d'une lib externe pour les quatre unités dont on a besoin ici.
function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) return 30 * 24 * 60 * 60 * 1000; // repli : 30 jours

  const amount = Number(match[1]);
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * unitMs[match[2]];
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { email: dto.email, fullName: dto.fullName, passwordHash },
    });

    const tokens = await this.issueTokens(user.id);
    return { user: this.toUserDto(user), tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Même message pour "email inconnu" et "mauvais mot de passe" : ne jamais révéler
    // lequel des deux est faux.
    if (!user || !user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const tokens = await this.issueTokens(user.id);
    return { user: this.toUserDto(user), tokens };
  }

  // Rotation : l'ancien jeton est révoqué dès qu'un nouveau est émis, jamais réutilisable.
  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Jeton de rafraîchissement invalide ou expiré');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.userId);
  }

  // Idempotent : un jeton déjà révoqué ou inconnu ne renvoie pas d'erreur, pour ne pas
  // révéler par la réponse si un jeton donné a existé.
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.toUserDto(user);
  }

  private async issueTokens(userId: string): Promise<AuthTokensDto> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'change-me'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      },
    );

    const refreshTokenExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + parseDurationMs(refreshTokenExpiresIn)),
      },
    });

    return { accessToken, refreshToken };
  }

  private toUserDto(user: { id: string; email: string; fullName: string }): AuthUserDto {
    return { id: user.id, email: user.email, fullName: user.fullName };
  }
}
