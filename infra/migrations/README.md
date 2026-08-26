# Migrations

Les migrations Prisma générées par `npx prisma migrate dev` vivent dans
`apps/api/prisma/migrations/` (emplacement standard Prisma, versionné avec le code de l'API).

Ce dossier est réservé aux scripts SQL ou opérations d'infrastructure qui ne passent pas
par Prisma (scripts ponctuels, ajustements manuels validés en revue).
