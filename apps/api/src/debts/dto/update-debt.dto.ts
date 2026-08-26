import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// type/accountId ne sont pas modifiables après création : autant créer une nouvelle entrée.
export class UpdateDebtDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  counterpartyName?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'principalAmount doit être un montant décimal positif (ex: "50000.00")' })
  principalAmount?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
