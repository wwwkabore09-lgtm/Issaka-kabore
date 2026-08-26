import { IsUUID } from 'class-validator';

export class ListTransactionsQueryDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  accountId!: string;
}
