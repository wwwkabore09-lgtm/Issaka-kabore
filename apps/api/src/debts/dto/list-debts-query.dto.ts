import { DEBT_DIRECTIONS, type DebtDirection } from '@finza/shared-types';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ListDebtsQueryDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsIn(DEBT_DIRECTIONS)
  type?: DebtDirection;
}
