import { IsISO8601 } from 'class-validator';
import { ListTransactionsQueryDto } from './list-transactions-query.dto';

// accountId hérité de ListTransactionsQueryDto reste optionnel : fourni, résumé d'un seul
// compte (page de détail) ; omis, résumé tous comptes confondus (tableau de bord).
export class GetSummaryQueryDto extends ListTransactionsQueryDto {
  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}
