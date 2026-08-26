import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Prêt à protéger des routes (@UseGuards(JwtAuthGuard)) dès qu'un domaine migre du userId
// manuel vers l'utilisateur authentifié — voir @CurrentUser().
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
