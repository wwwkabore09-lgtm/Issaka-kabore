import { IsISO8601 } from 'class-validator';
import { ListTransactionsQueryDto } from './list-transactions-query.dto';

export class GetSummaryQueryDto extends ListTransactionsQueryDto {
  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;
}
