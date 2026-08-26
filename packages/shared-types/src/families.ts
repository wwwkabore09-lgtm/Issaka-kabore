export type FamilyRole = 'owner' | 'member';

export interface FamilyMemberDto {
  userId: string;
  fullName: string;
  email: string;
  role: FamilyRole;
  joinedAt: string;
}

export interface FamilyDto {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members: FamilyMemberDto[];
}

export interface CreateFamilyRequest {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  userId: string;
  name: string;
}

export interface AddFamilyMemberRequest {
  // userId de l'appelant (doit être le propriétaire) ; temporaire, cf. domaine Accounts.
  requestingUserId: string;
  // userId du membre à ajouter — pas d'invitation par email tant que l'auth n'existe pas :
  // le propriétaire doit connaître l'identifiant de la personne à ajouter.
  memberUserId: string;
}

// Compte partagé visible par les autres membres de la famille : jamais les
// transactions/budgets/objectifs du propriétaire, seulement ces informations minimales.
export interface SharedAccountDto {
  id: string;
  name: string;
  currency: string;
  currentBalance: string;
  ownerUserId: string;
  ownerName: string;
}
