import { IsUUID, Matches } from 'class-validator';

export class CreateBudgetDto {
  @IsUUID()
  accountId!: string;

  @IsUUID()
  categoryId!: string;

  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount doit être un montant décimal positif (ex: "50000.00")' })
  amount!: string;
}
