// Session JWT stockée côté client. finza_demo_user_id garde l'identité de l'utilisateur
// connecté (utile pour des comparaisons de rôle côté UI, ex: propriétaire vs membre sur la
// page Famille) — jamais utilisé seul pour l'authentification, toujours accompagné du token.
const ACCESS_TOKEN_KEY = 'finza_access_token';
const REFRESH_TOKEN_KEY = 'finza_refresh_token';
const USER_ID_KEY = 'finza_demo_user_id';
const USER_EMAIL_KEY = 'finza_user_email';

export interface StoredSession {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export function saveSession(session: StoredSession) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  window.localStorage.setItem(USER_ID_KEY, session.userId);
  window.localStorage.setItem(USER_EMAIL_KEY, session.email);
}

export function clearSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_EMAIL_KEY);
  window.localStorage.removeItem(USER_ID_KEY);
}

// Remplace uniquement les jetons (après un rafraîchissement silencieux sur 401) — userId et
// email n'ont pas changé, donc pas besoin d'une session complète comme saveSession().
export function updateTokens(tokens: { accessToken: string; refreshToken: string }) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function getStoredRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredUserId(): string | null {
  return window.localStorage.getItem(USER_ID_KEY);
}

export function getStoredUserEmail(): string | null {
  return window.localStorage.getItem(USER_EMAIL_KEY);
}
