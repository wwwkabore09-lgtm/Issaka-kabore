import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// type, ownership et currency ne sont volontairement pas modifiables après création :
// les changer rétroactivement casserait la cohérence du grand livre (AccountBalanceEntry).
export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSharedWithFamily?: boolean;
}
