import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFamilyDto {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  @IsUUID()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
