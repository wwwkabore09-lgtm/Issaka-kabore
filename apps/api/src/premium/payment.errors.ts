// Erreurs typées du module premium/paiement — chacune porte un message déjà sûr à renvoyer
// tel quel au client (jamais de détail technique, jamais une clé du prestataire). Le
// controller les traduit en codes HTTP ; les services ne construisent jamais de
// HttpException eux-mêmes, pour rester testables sans dépendre de NestJS.

export class PaymentNotConfiguredError extends Error {
  constructor() {
    super("Le paiement en ligne n'est pas encore configuré.");
    this.name = 'PaymentNotConfiguredError';
  }
}

export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super('Signature du webhook invalide.');
    this.name = 'InvalidWebhookSignatureError';
  }
}

export class UnknownPaymentError extends Error {
  constructor() {
    super('Transaction inconnue.');
    this.name = 'UnknownPaymentError';
  }
}

export class PaymentAmountMismatchError extends Error {
  constructor() {
    super('Le montant confirmé ne correspond pas au montant attendu.');
    this.name = 'PaymentAmountMismatchError';
  }
}

export class PaymentProviderError extends Error {
  constructor(message = 'Le service de paiement est temporairement indisponible. Réessayez dans un instant.') {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

export class AlreadySubscribedError extends Error {
  constructor() {
    super('Vous avez déjà un abonnement Premium actif.');
    this.name = 'AlreadySubscribedError';
  }
}
