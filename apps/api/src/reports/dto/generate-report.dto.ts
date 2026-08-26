import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateReportDto {
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
