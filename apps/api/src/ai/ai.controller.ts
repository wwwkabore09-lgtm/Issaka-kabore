import { Body, Controller, Get, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { AskAdviceDto } from './dto/ask-advice.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PremiumGuard } from '../premium/premium.guard';
import { AiEmptyResponseError, AiNotConfiguredError, AiProviderError, AiRateLimitedError, AiTimeoutError } from './ai.errors';

// Chaque appel a un coût réel (facturation Gemini) — resserré par rapport au défaut global
// (voir AppModule) même pour un utilisateur Premium légitime, pour plafonner le coût
// d'abus possible depuis un seul compte/jeton.
const AI_THROTTLE = { default: { limit: 15, ttl: 60_000 } };

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

// L'Assistant IA est une fonctionnalité Premium (voir module premium) : PremiumGuard refuse
// l'accès côté serveur si l'utilisateur n'est pas abonné, quel que soit ce que montre le
// frontend — jamais une restriction seulement visuelle.
@Controller('ai')
@UseGuards(JwtAuthGuard, PremiumGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('advice')
  @Throttle(AI_THROTTLE)
  async advice(@CurrentUser() userId: string, @Body() dto: AskAdviceDto) {
    try {
      return await this.aiService.getAdvice(userId, dto);
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get('summary')
  @Throttle(AI_THROTTLE)
  async summary(@CurrentUser() userId: string) {
    try {
      return await this.aiService.getMonthlySummary(userId);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}
