import { REVENUE_CATEGORIES, REVENUE_FREQUENCIES, type RevenueCategory, type RevenueFrequency } from '@finza/shared-types';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// ownership et currency ne sont volontairement pas modifiables après création : les changer
// rétroactivement casserait la cohérence du grand livre (AccountBalanceEntry). category et
// frequency sont purement descriptifs (aucun impact sur le solde) et peuvent être corrigés
// librement par l'utilisateur.
export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsIn(REVENUE_CATEGORIES)
  category?: RevenueCategory;

  @IsOptional()
  @IsIn(REVENUE_FREQUENCIES)
  frequency?: RevenueFrequency;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSharedWithFamily?: boolean;
}
