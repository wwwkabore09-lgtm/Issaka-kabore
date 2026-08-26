import { Matches } from 'class-validator';

// accountId/categoryId ne sont pas modifiables après création : changer la catégorie d'un
// budget existant n'a pas de sens (autant en créer un nouveau et supprimer l'ancien).
export class UpdateBudgetDto {
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'amount doit être un montant décimal positif (ex: "50000.00")' })
  amount!: string;
}
