import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateContributionDto {
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount doit être un montant décimal positif (ex: "10000.00")' })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;

  @IsOptional()
  @IsISO8601()
  contributedAt?: string;
}
