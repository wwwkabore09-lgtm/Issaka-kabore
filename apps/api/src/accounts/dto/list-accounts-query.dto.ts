import { IsUUID } from 'class-validator';

export class ListAccountsQueryDto {
  @IsUUID()
  userId!: string;
}
