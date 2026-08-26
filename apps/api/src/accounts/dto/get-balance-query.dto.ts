import { IsISO8601, IsOptional } from 'class-validator';
import { ListAccountsQueryDto } from './list-accounts-query.dto';

export class GetBalanceQueryDto extends ListAccountsQueryDto {
  // Date à laquelle reconstituer le solde. Par défaut : maintenant.
  @IsOptional()
  @IsISO8601()
  asOf?: string;
}
