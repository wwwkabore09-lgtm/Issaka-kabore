-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('income', 'expense', 'transfer');

-- AlterEnum
ALTER TYPE "BalanceEntrySource" ADD VALUE 'transaction';

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "categoryId" TEXT,
    "transferToAccountId" TEXT,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_key_key" ON "categories"("userId", "key");

-- CreateIndex
CREATE INDEX "transactions_accountId_occurredAt_idx" ON "transactions"("accountId", "occurredAt");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_transferToAccountId_fkey" FOREIGN KEY ("transferToAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
