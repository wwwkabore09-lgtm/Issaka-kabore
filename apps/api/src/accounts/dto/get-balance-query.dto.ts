import { IsISO8601, IsOptional } from 'class-validator';

export class GetBalanceQueryDto {
  // Date à laquelle reconstituer le solde. Par défaut : maintenant.
  @IsOptional()
  @IsISO8601()
  asOf?: string;
}
