import { ConfigService } from '@nestjs/config';
import { ApiError } from '@google/genai';
import { GeminiService } from './gemini.service';
import { AiEmptyResponseError, AiNotConfiguredError, AiRateLimitedError, AiTimeoutError } from './ai.errors';

const generateContentMock = jest.fn();

jest.mock('@google/genai', () => {
  const actual = jest.requireActual('@google/genai');
  return {
    ...actual,
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: { generateContent: generateContentMock },
    })),
  };
});

describe('GeminiService', () => {
  let configService: { get: jest.Mock };

  beforeEach(() => {
    generateContentMock.mockReset();
    configService = { get: jest.fn((key: string, fallback?: string) => (key === 'GEMINI_API_KEY' ? 'fake-key' : fallback)) };
  });

  it('isConfigured() est false quand GEMINI_API_KEY est absente', () => {
    configService.get.mockImplementation((key: string, fallback?: string) => (key === 'GEMINI_API_KEY' ? undefined : fallback));
    const service = new GeminiService(configService as unknown as ConfigService);

    expect(service.isConfigured()).toBe(false);
  });

  it("generateReply() lève AiNotConfiguredError si la clé est absente, sans jamais tenter d'appel réseau", async () => {
    configService.get.mockImplementation((key: string, fallback?: string) => (key === 'GEMINI_API_KEY' ? undefined : fallback));
    const service = new GeminiService(configService as unknown as ConfigService);

    await expect(service.generateReply('system', [], 'question')).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('retourne le texte de la réponse quand tout va bien', async () => {
    generateContentMock.mockResolvedValue({ text: '  Voici un conseil.  ' });
    const service = new GeminiService(configService as unknown as ConfigService);

    const reply = await service.generateReply('system', [], 'question');

    expect(reply).toBe('Voici un conseil.');
  });

  it('lève AiEmptyResponseError si Gemini ne renvoie aucun texte', async () => {
    generateContentMock.mockResolvedValue({ text: '' });
    const service = new GeminiService(configService as unknown as ConfigService);

    await expect(service.generateReply('system', [], 'question')).rejects.toBeInstanceOf(AiEmptyResponseError);
  });

  it('lève AiRateLimitedError sur une ApiError 429', async () => {
    generateContentMock.mockRejectedValue(new ApiError({ message: 'Too Many Requests', status: 429 }));
    const service = new GeminiService(configService as unknown as ConfigService);

    await expect(service.generateReply('system', [], 'question')).rejects.toBeInstanceOf(AiRateLimitedError);
  });

  it('lève AiProviderError sur une autre ApiError, sans exposer le détail technique', async () => {
    generateContentMock.mockRejectedValue(new ApiError({ message: 'Internal error XYZ', status: 500 }));
    const service = new GeminiService(configService as unknown as ConfigService);

    await expect(service.generateReply('system', [], 'question')).rejects.toMatchObject({
      message: expect.not.stringContaining('XYZ'),
    });
  });

  it('lève AiTimeoutError si la requête dépasse le délai imparti', async () => {
    generateContentMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          // Simule l'annulation du signal plutôt que d'attendre le vrai timeout de 30s.
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        }),
    );
    const service = new GeminiService(configService as unknown as ConfigService);

    await expect(service.generateReply('system', [], 'question')).rejects.toBeInstanceOf(AiTimeoutError);
  });

  it('plafonne l\'historique transmis à Gemini (au plus 20 tours)', async () => {
    generateContentMock.mockResolvedValue({ text: 'ok' });
    const service = new GeminiService(configService as unknown as ConfigService);
    const history = Array.from({ length: 30 }, (_, i) => ({ role: 'user' as const, content: `tour ${i}` }));

    await service.generateReply('system', history, 'question');

    const callArgs = generateContentMock.mock.calls[0][0];
    // 20 tours d'historique + le nouveau message de l'utilisateur.
    expect(callArgs.contents).toHaveLength(21);
    expect(callArgs.contents[0].parts[0].text).toBe('tour 10');
  });
});
