import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class ListBudgetsQueryDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  accountId!: string;

  // Période sur laquelle calculer la progression. Par défaut : le mois courant.
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
