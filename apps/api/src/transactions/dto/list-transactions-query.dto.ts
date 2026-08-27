import { TRANSACTION_TYPES, type TransactionType } from '@finza/shared-types';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// accountId est optionnel : omis, la recherche porte sur tous les comptes de l'utilisateur
// (vue "Transactions" centralisée) ; fourni, elle se limite à ce compte (page d'un compte).
export class ListTransactionsQueryDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  q?: string;
}
