# Finza

Financial OS personnel et familial pour l'Afrique francophone (lancement Burkina Faso).
Consolide Mobile Money, comptes bancaires et espèces dans une seule vue, avec budgets,
objectifs d'épargne, dettes, prévisions et un assistant IA scopé aux données de l'utilisateur.

## Stack

- **Web** : Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **API** : NestJS (Node.js/TypeScript), REST
- **Base de données** : PostgreSQL + Prisma
- **Cache / jobs async** : Redis + BullMQ
- **Stockage fichiers** : S3-compatible (MinIO en local)
- **Auth** : JWT + refresh tokens
- **IA** : couche d'abstraction (Claude / OpenAI interchangeables)

## Arborescence

```
apps/
  web/        # Next.js
  api/        # NestJS
  admin/      # Finza Admin (interne)
packages/
  shared-types/  # DTOs/types partagés
  ui/            # composants partagés
  config/        # config multi-pays (devises, catégories, opérateurs)
infra/
  docker-compose.yml
  migrations/
docs/
```

## Démarrage local

```bash
cp .env.example .env      # puis renseigner les secrets locaux
npm install

docker compose -f infra/docker-compose.yml up -d   # Postgres, Redis, MinIO

npx prisma migrate dev --schema apps/api/prisma/schema.prisma
npm run dev:api            # API en mode watch (http://localhost:3001)
npm run dev:web            # Frontend Next.js (http://localhost:3000)
npm run dev:admin          # Admin interne (http://localhost:3002)
```

## Méthode de travail

Chaque feature est développée comme une unité verticale complète, dans cet ordre :

1. Migration Prisma (table/colonnes)
2. Module NestJS (entité, service, controller, DTO, validation)
3. Tests (unitaires service, e2e endpoint)
4. Page/composant Next.js correspondant + appel API
5. Vérification manuelle / critères d'acceptation

Un domaine métier par tâche — pas de mélange entre modules (accounts, transactions, budgets,
goals, debts, families, subscriptions, reports).

## Règles non négociables

- Jamais de PIN Mobile Money ni d'identifiants bancaires stockés — uniquement des flux
  d'autorisation officiels.
- Aucune transaction importée (CSV/PDF) ne s'insère sans validation utilisateur la première
  fois qu'une source/format est rencontré.
- Le Finza Score n'est jamais un score de crédit ou une décision bancaire.
- En mode famille, les comptes personnels non partagés restent invisibles par défaut.
- Toute route admin exposant des données financières en clair est journalisée et nécessite
  une double validation.
- L'assistant Finza ne répond qu'avec les données auxquelles l'utilisateur a donné accès —
  jamais de conseil d'investissement ferme ni de conseil de crédit.
- Les transactions de type `transfer` sont toujours exclues des agrégats revenus/dépenses.
- Le solde d'un compte doit être reconstituable à toute date (grand livre), jamais uniquement
  via un champ `currentBalance`.
