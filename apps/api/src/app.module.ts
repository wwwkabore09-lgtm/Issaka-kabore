import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// PrismaModule (src/prisma/) est prêt mais volontairement non importé ici :
// prisma generate n'a rien à générer tant qu'aucun modèle métier n'existe dans schema.prisma.
// Le premier module de domaine (ex: accounts) qui ajoute des modèles doit importer PrismaModule.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
