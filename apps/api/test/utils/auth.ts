import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

// Passe par le vrai flux HTTP (/auth/register) plutôt que de créer un User directement en
// base : les tests obtiennent ainsi un access token valide, comme un vrai client.
export async function registerTestUser(
  app: INestApplication,
  overrides: { email: string; fullName: string; password?: string },
): Promise<{ userId: string; accessToken: string }> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email: overrides.email,
      fullName: overrides.fullName,
      password: overrides.password ?? 'motdepasse123',
    })
    .expect(201);

  return { userId: res.body.user.id as string, accessToken: res.body.tokens.accessToken as string };
}

export function authHeader(accessToken: string): [string, string] {
  return ['Authorization', `Bearer ${accessToken}`];
}
