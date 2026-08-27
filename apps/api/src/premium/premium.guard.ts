import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PremiumService } from './premium.service';

interface RequestWithUser {
  user: { userId: string };
}

// À utiliser après JwtAuthGuard (@UseGuards(JwtAuthGuard, PremiumGuard)) : refuse l'accès
// côté SERVEUR si l'utilisateur n'est pas Premium, quelle que soit l'UI du frontend. Jamais
// une restriction uniquement côté client — voir section "Accès aux fonctionnalités Premium"
// du cahier des charges.
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly premiumService: PremiumService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const isPremium = await this.premiumService.isPremium(request.user.userId);
    if (!isPremium) {
      throw new ForbiddenException('Cette fonctionnalité est réservée aux abonnés Premium.');
    }
    return true;
  }
}
