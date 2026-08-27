import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

const INSECURE_DEFAULT_JWT_SECRET = 'change-me';

async function bootstrap() {
  // Le secret JWT retombe sur "change-me" en dev/test pour ne rien exiger avant de lancer
  // l'app localement — mais ce même repli en production forgerait n'importe quel jeton
  // d'accès à quiconque lit ce fichier. On refuse donc de démarrer en production sans un
  // vrai secret configuré.
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET === INSECURE_DEFAULT_JWT_SECRET)
  ) {
    throw new Error(
      'JWT_ACCESS_SECRET doit être défini avec une vraie valeur secrète en production (jamais "change-me").',
    );
  }

  // rawBody: true préserve les octets bruts de chaque requête (req.rawBody) sans désactiver
  // le parsing JSON habituel — nécessaire pour vérifier la signature HMAC du webhook de
  // paiement, qui doit porter sur les octets exacts envoyés par le prestataire, jamais sur
  // une version reparsée/reformatée par Express.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // CORS_ORIGIN vide = toutes origines autorisées (développement) ; en production, restreindre
  // à l'URL réelle du frontend déployé (liste séparée par des virgules pour plusieurs domaines).
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  app.enableCors({ origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

bootstrap();
