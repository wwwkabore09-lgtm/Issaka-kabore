import { HttpException, HttpStatus } from '@nestjs/common';
import {
  AlreadySubscribedError,
  InvalidWebhookSignatureError,
  PaymentAmountMismatchError,
  PaymentNotConfiguredError,
  PaymentProviderError,
  UnknownPaymentError,
} from './payment.errors';

// Chaque erreur du module premium/paiement porte déjà un message sûr à renvoyer tel quel
// (jamais de détail technique, jamais une clé du prestataire) — ce mapping ne fait que
// choisir le bon code HTTP.
export function toPaymentHttpException(error: unknown): HttpException {
  if (error instanceof PaymentNotConfiguredError) return new HttpException(error.message, HttpStatus.SERVICE_UNAVAILABLE);
  if (error instanceof AlreadySubscribedError) return new HttpException(error.message, HttpStatus.CONFLICT);
  if (error instanceof InvalidWebhookSignatureError) return new HttpException(error.message, HttpStatus.UNAUTHORIZED);
  if (error instanceof UnknownPaymentError) return new HttpException(error.message, HttpStatus.NOT_FOUND);
  if (error instanceof PaymentAmountMismatchError) return new HttpException(error.message, HttpStatus.UNPROCESSABLE_ENTITY);
  if (error instanceof PaymentProviderError) return new HttpException(error.message, HttpStatus.BAD_GATEWAY);
  throw error;
}
