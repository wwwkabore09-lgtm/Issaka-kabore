import { IsUUID } from 'class-validator';

export class OwnerQueryDto {
  @IsUUID()
  userId!: string;
}
