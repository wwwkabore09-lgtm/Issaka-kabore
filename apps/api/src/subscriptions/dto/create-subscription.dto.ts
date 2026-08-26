import { BILLING_FREQUENCIES, type BillingFrequency } from '@finza/shared-types';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateSubscriptionDto {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount doit être un montant décimal positif (ex: "5000.00")' })
  amount!: string;

  @IsIn(BILLING_FREQUENCIES)
  billingFrequency!: BillingFrequency;

  @IsISO8601()
  nextBillingDate!: string;
}
