import { FINANCIAL_SITUATIONS, REVENUE_FREQUENCIES, type FinancialSituation, type RevenueFrequency } from '@finza/shared-types';
import { COUNTRIES } from '@finza/config';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const COUNTRY_CODES = Object.keys(COUNTRIES);
// Extensible sans redéploiement du schéma : uniquement une allowlist DTO, jamais un enum DB.
const SUPPORTED_LANGUAGES = ['fr', 'en'];

export class UpdateProfileDto {
  @IsOptional()
  @IsIn(COUNTRY_CODES, { message: `country doit être l'un de : ${COUNTRY_CODES.join(', ')}` })
  country?: string | null;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mainFinancialGoal?: string | null;

  @IsOptional()
  @IsIn(REVENUE_FREQUENCIES)
  incomeFrequency?: RevenueFrequency | null;

  @IsOptional()
  @IsIn(FINANCIAL_SITUATIONS)
  financialSituation?: FinancialSituation | null;
}
