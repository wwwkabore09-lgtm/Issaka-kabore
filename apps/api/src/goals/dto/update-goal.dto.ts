import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// accountId n'est pas modifiable après création : autant créer un nouvel objectif.
export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'targetAmount doit être un montant décimal positif (ex: "500000.00")' })
  targetAmount?: string;

  // undefined = ne pas modifier ; null = effacer la date cible existante (IsOptional laisse
  // passer null sans lancer IsISO8601 dessus).
  @IsOptional()
  @IsISO8601()
  targetDate?: string | null;
}
