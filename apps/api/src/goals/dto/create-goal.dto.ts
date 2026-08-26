import { IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateGoalDto {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'targetAmount doit être un montant décimal positif (ex: "500000.00")' })
  targetAmount!: string;

  @IsOptional()
  @IsISO8601()
  targetDate?: string;
}
