// Pont entre le domaine auth (tokens JWT) et le mécanisme "userId manuel" utilisé par
// tous les autres domaines tant qu'ils n'ont pas migré vers l'authentification réelle :
// se connecter remplit aussi finza_demo_user_id, donc le reste de l'app "fonctionne" tout
// de suite pour l'utilisateur connecté, sans que chaque page vérifie le token côté serveur.
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
  // finza_demo_user_id est volontairement conservé : l'utilisateur peut continuer à
  // l'utiliser manuellement pour les domaines pas encore protégés par JWT.
}

export function getStoredRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUserEmail(): string | null {
  return window.localStorage.getItem(USER_EMAIL_KEY);
}
