import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import type { ChatTurn } from '@finza/shared-types';

class ChatTurnDto implements ChatTurn {
  @IsIn(['user', 'model'])
  role!: 'user' | 'model';

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}

export class AskAdviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  // Géré côté client, jamais persisté : plafonné pour éviter qu'une conversation trop
  // longue ne gonfle inutilement le coût de chaque appel Gemini.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}
