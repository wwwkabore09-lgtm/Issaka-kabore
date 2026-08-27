import { Body, Controller, Get, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AskAdviceDto } from './dto/ask-advice.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiEmptyResponseError, AiNotConfiguredError, AiProviderError, AiRateLimitedError, AiTimeoutError } from './ai.errors';

// Chaque erreur du module IA porte déjà un message sûr à renvoyer tel quel (jamais de detail
// technique ni la clé API) — ce mapping ne fait que choisir le bon code HTTP.
function toHttpException(error: unknown): HttpException {
  if (error instanceof AiNotConfiguredError) return new HttpException(error.message, HttpStatus.SERVICE_UNAVAILABLE);
  if (error instanceof AiTimeoutError) return new HttpException(error.message, HttpStatus.GATEWAY_TIMEOUT);
  if (error instanceof AiRateLimitedError) return new HttpException(error.message, HttpStatus.TOO_MANY_REQUESTS);
  if (error instanceof AiEmptyResponseError) return new HttpException(error.message, HttpStatus.BAD_GATEWAY);
  if (error instanceof AiProviderError) return new HttpException(error.message, HttpStatus.BAD_GATEWAY);
  throw error;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('advice')
  async advice(@CurrentUser() userId: string, @Body() dto: AskAdviceDto) {
    try {
      return await this.aiService.getAdvice(userId, dto);
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get('summary')
  async summary(@CurrentUser() userId: string) {
    try {
      return await this.aiService.getMonthlySummary(userId);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}
