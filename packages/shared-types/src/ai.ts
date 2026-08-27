// Types pour l'assistant financier IA (Gemini) — voir apps/api/src/ai.
// L'IA ne voit jamais de mot de passe, jeton, clé API ni identifiant de paiement : uniquement
// un résumé financier agrégé (voir FinancialContextDto) et le message de l'utilisateur.

export interface ChatTurn {
  role: 'user' | 'model';
  content: string;
}

export interface AskAdviceRequest {
  message: string;
  // Historique géré côté client (pas persisté en base) : la conversation repart de zéro à
  // chaque rechargement de page, ou dès que l'utilisateur clique "Nouvelle conversation".
  history?: ChatTurn[];
}

export interface AdviceResponseDto {
  reply: string;
}
