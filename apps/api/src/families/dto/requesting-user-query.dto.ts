import { IsUUID } from 'class-validator';

export class RequestingUserQueryDto {
  @IsUUID()
  requestingUserId!: string;
}
