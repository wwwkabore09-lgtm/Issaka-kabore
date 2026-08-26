import { BILLING_FREQUENCIES, type BillingFrequency } from '@finza/shared-types';
import { IsBoolean, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

// accountId n'est pas modifiable après création : autant créer un nouvel abonnement.
export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount doit être un montant décimal positif (ex: "5000.00")' })
  amount?: string;

  @IsOptional()
  @IsIn(BILLING_FREQUENCIES)
  billingFrequency?: BillingFrequency;

  @IsOptional()
  @IsISO8601()
  nextBillingDate?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
