import { IsUUID } from 'class-validator';

export class AddMemberDto {
  // Pas d'invitation par email tant que l'auth n'existe pas : le propriétaire doit
  // connaître l'identifiant de la personne à ajouter.
  @IsUUID()
  memberUserId!: string;
}
