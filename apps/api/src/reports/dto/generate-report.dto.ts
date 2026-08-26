import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GenerateReportDto {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  // Par défaut : le mois courant.
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
