-- Ajoute un profil optionnel à l'utilisateur, utilisé pour personnaliser l'assistant IA
-- (module `ai`) : pays, langue, objectif financier principal, fréquence de revenus,
-- situation financière déclarée. Tous les champs sont nullable — jamais requis à
-- l'inscription, et l'assistant doit dire clairement quand une info manque plutôt que
-- l'inventer.
--
-- `country` reste une chaîne libre (validée contre @finza/config COUNTRIES au niveau DTO,
-- pas de la base) pour pouvoir ajouter des pays sans nouvelle migration.

-- CreateEnum
CREATE TYPE "FinancialSituation" AS ENUM ('stable', 'tendue', 'variable', 'en_amelioration');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "country" TEXT;
ALTER TABLE "users" ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE "users" ADD COLUMN "mainFinancialGoal" TEXT;
ALTER TABLE "users" ADD COLUMN "incomeFrequency" "RevenueFrequency";
ALTER TABLE "users" ADD COLUMN "financialSituation" "FinancialSituation";
