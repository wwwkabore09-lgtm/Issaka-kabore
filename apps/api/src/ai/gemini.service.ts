import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError, GoogleGenAI } from '@google/genai';
import type { ChatTurn } from '@finza/shared-types';
import { AiEmptyResponseError, AiNotConfiguredError, AiProviderError, AiRateLimitedError, AiTimeoutError } from './ai.errors';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_HISTORY_TURNS = 20;

// Fine couche autour du SDK @google/genai : c'est le SEUL endroit du backend qui connaît
// GEMINI_API_KEY (jamais lue ni transmise ailleurs, jamais envoyée au frontend, jamais
// loguée). Toute erreur du SDK est normalisée en une des erreurs de ai.errors.ts avant de
// remonter — le reste de l'application ne voit jamais les détails du transport HTTP.
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private client: GoogleGenAI | null = null;
  private clientInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>('GEMINI_API_KEY'));
  }

  private getClient(): GoogleGenAI {
    if (!this.clientInitialized) {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
      this.clientInitialized = true;
    }
    if (!this.client) {
      throw new AiNotConfiguredError();
    }
    return this.client;
  }

  async generateReply(systemInstruction: string, history: ChatTurn[], userMessage: string): Promise<string> {
    const client = this.getClient();
    const model = this.configService.get<string>('GEMINI_MODEL', DEFAULT_MODEL);

    const contents = [
      ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.content }],
      })),
      { role: 'user' as const, parts: [{ text: userMessage }] },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.4,
          maxOutputTokens: 1024,
          abortSignal: controller.signal,
        },
      });

      const text = response.text;
      if (!text || !text.trim()) {
        throw new AiEmptyResponseError();
      }
      return text.trim();
    } catch (error) {
      if (error instanceof AiEmptyResponseError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(`Délai dépassé en appelant Gemini (modèle=${model})`);
        throw new AiTimeoutError();
      }

      if (error instanceof ApiError) {
        this.logger.error(`Erreur API Gemini (status=${error.status}): ${error.message}`);
        if (error.status === 429) throw new AiRateLimitedError();
        throw new AiProviderError();
      }

      this.logger.error(`Erreur inattendue en appelant Gemini: ${error instanceof Error ? error.message : String(error)}`);
      throw new AiProviderError();
    } finally {
      clearTimeout(timeout);
    }
  }
}
