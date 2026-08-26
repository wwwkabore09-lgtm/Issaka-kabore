import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithUser {
  user: { userId: string };
}

// À utiliser sous @UseGuards(JwtAuthGuard) : extrait l'id de l'utilisateur authentifié
// depuis req.user, posé par JwtStrategy.validate().
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user.userId;
});
