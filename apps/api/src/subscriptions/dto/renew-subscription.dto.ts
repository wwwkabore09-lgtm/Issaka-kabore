import { IsUUID } from 'class-validator';

export class RenewSubscriptionDto {
  // Temporaire : tant que le domaine auth n'existe pas (cf. domaine Accounts).
  @IsUUID()
  userId!: string;
}
