import { DEBT_DIRECTIONS, type DebtDirection } from '@finza/shared-types';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateDebtDto {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  @IsUUID()
  userId!: string;

  @IsIn(DEBT_DIRECTIONS)
  type!: DebtDirection;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  counterpartyName!: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'principalAmount doit être un montant décimal positif (ex: "50000.00")' })
  principalAmount!: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
