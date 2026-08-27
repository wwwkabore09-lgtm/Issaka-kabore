import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface RequestWithUser {
  user: { userId: string };
}

// Le rôle admin n'est jamais porté par le JWT (JwtStrategy ne renvoie que l'id) : rechargé
// depuis la base à chaque requête, pour qu'un retrait de droit prenne effet immédiatement
// plutôt que d'attendre l'expiration du token.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = await this.prisma.user.findUnique({ where: { id: request.user.userId }, select: { isAdmin: true } });
    if (!user?.isAdmin) {
      throw new ForbiddenException('Accès réservé aux administrateurs.');
    }
    return true;
  }
}
