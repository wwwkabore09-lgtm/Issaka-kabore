import { ACCOUNT_OWNERSHIPS, ACCOUNT_TYPES, type AccountOwnership, type AccountType } from '@finza/shared-types';
import { CURRENCIES } from '@finza/config';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const CURRENCY_CODES = Object.keys(CURRENCIES);

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(ACCOUNT_TYPES)
  type!: AccountType;

  @IsOptional()
  @IsIn(ACCOUNT_OWNERSHIPS)
  ownership?: AccountOwnership;

  @IsIn(CURRENCY_CODES)
  currency!: string;

  @IsOptional()
  @Matches(/^-?\d+(\.\d{1,2})?$/, { message: 'openingBalance doit être un montant décimal (ex: "1500.00")' })
  openingBalance?: string;

  @IsOptional()
  @IsISO8601()
  openingBalanceDate?: string;
}
