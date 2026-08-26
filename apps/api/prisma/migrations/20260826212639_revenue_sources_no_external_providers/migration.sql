-- Retire toute notion de fournisseur externe (Orange Money, Moov Money, MTN Mobile Money,
-- Wave, compte bancaire) du modèle Account. Un compte devient une source d'argent suivie
-- manuellement par l'utilisateur, classée par catégorie de revenu et fréquence attendue.
--
-- Aucune donnée de production existante à ce jour (pré-lancement) : les comptes existants
-- sont reclassés en 'autre' / 'monthly' plutôt que migrés champ par champ depuis l'ancien
-- type externe, qui n'a plus de sens dans le nouveau modèle.

-- CreateEnum
CREATE TYPE "RevenueCategory" AS ENUM ('salaire', 'activite_professionnelle', 'commerce', 'freelance', 'argent_de_poche', 'revenu_secondaire', 'autre');

-- CreateEnum
CREATE TYPE "RevenueFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'variable');

-- AlterTable: ajoute category avec une valeur temporaire, ajoute frequency, puis retire l'ancien type.
ALTER TABLE "accounts" ADD COLUMN "category" "RevenueCategory" NOT NULL DEFAULT 'autre';
ALTER TABLE "accounts" ADD COLUMN "frequency" "RevenueFrequency" NOT NULL DEFAULT 'monthly';
ALTER TABLE "accounts" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "accounts" DROP COLUMN "type";

-- DropEnum
DROP TYPE "AccountType";
