import { DEBT_DIRECTIONS, type DebtDirection } from '@finza/shared-types';
import { IsIn, IsOptional } from 'class-validator';

export class ListDebtsQueryDto {
  @IsOptional()
  @IsIn(DEBT_DIRECTIONS)
  type?: DebtDirection;
}
