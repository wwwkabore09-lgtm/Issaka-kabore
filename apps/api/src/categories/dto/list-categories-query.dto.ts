import { IsUUID } from 'class-validator';

export class ListCategoriesQueryDto {
  @IsUUID()
  userId!: string;
}
