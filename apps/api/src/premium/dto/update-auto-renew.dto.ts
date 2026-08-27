import { IsBoolean } from 'class-validator';
import type { UpdateAutoRenewRequest } from '@finza/shared-types';

export class UpdateAutoRenewDto implements UpdateAutoRenewRequest {
  @IsBoolean()
  autoRenew!: boolean;
}
