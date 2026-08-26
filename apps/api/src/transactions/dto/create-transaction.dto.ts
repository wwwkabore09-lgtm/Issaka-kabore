import { TRANSACTION_TYPES, type TransactionType } from '@finza/shared-types';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateTransactionDto {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  @IsUUID()
  userId!: string;

  @IsUUID()
  accountId!: string;

  @IsIn(TRANSACTION_TYPES)
  type!: TransactionType;

  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount doit être un montant décimal positif (ex: "1500.00")' })
  amount!: string;

  // Requis pour income/expense, doit être absent pour transfer (validé dans le service :
  // dépend de `type`, pas exprimable proprement avec class-validator seul).
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  // Requis pour transfer, doit être absent pour income/expense.
  @IsOptional()
  @IsUUID()
  transferToAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
