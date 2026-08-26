import { IsUUID } from 'class-validator';

export class AddMemberDto {
  // Doit être le propriétaire de la famille. Temporaire, cf. domaine Accounts.
  @IsUUID()
  requestingUserId!: string;

  // Pas d'invitation par email tant que l'auth n'existe pas : le propriétaire doit
  // connaître l'identifiant de la personne à ajouter.
  @IsUUID()
  memberUserId!: string;
}
