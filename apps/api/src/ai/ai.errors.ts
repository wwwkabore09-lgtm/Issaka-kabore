// Erreurs typées pour le module IA — chacune porte un message déjà sûr à renvoyer tel quel
// au client (jamais de détail technique, jamais la clé API). Le controller les traduit en
// codes HTTP ; le service ne construit jamais de HttpException lui-même pour rester
// testable sans dépendre de NestJS.

export class AiNotConfiguredError extends Error {
  constructor() {
    super("L'assistant IA n'est pas encore configuré.");
    this.name = 'AiNotConfiguredError';
  }
}

export class AiTimeoutError extends Error {
  constructor() {
    super("L'assistant IA met trop de temps à répondre. Réessayez dans un instant.");
    this.name = 'AiTimeoutError';
  }
}

export class AiRateLimitedError extends Error {
  constructor() {
    super("L'assistant IA reçoit trop de demandes en ce moment. Réessayez dans quelques instants.");
    this.name = 'AiRateLimitedError';
  }
}

export class AiEmptyResponseError extends Error {
  constructor() {
    super("L'assistant IA n'a pas pu générer de réponse cette fois-ci. Réessayez, ou reformulez votre question.");
    this.name = 'AiEmptyResponseError';
  }
}

export class AiProviderError extends Error {
  constructor() {
    super("Le service IA est temporairement indisponible. Réessayez dans un instant.");
    this.name = 'AiProviderError';
  }
}
