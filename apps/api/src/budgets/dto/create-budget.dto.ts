import { IsUUID, Matches } from 'class-validator';

export class CreateBudgetDto {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  @IsUUID()
  userId!: string;

  @IsUUID()
  accountId!: string;

  @IsUUID()
  categoryId!: string;

  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount doit être un montant décimal positif (ex: "50000.00")' })
  amount!: string;
}
