import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

// type/accountId/transferToAccountId ne sont pas modifiables après création : changer le
// sens d'une transaction ou son compte reviendrait à en créer une autre. occurredAt non plus :
// rien ne permet de retrouver l'écriture de grand livre déjà écrite pour la recaler sur la
// nouvelle date (le grand livre est append-only, jamais réécrit — voir appendLedgerEntry).
export class UpdateTransactionDto {
  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount doit être un montant décimal positif (ex: "1500.00")' })
  amount?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
