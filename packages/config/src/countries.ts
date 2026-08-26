import type { CurrencyCode } from './currencies';

export type CountryCode = 'BF' | 'CI' | 'SN' | 'ML';

export interface Country {
  code: CountryCode;
  label: string;
  currency: CurrencyCode;
  phonePrefix: string;
}

// Le Burkina Faso est le seul pays activé au lancement.
// Les autres pays UEMOA sont déclarés ici pour préparer l'extension, mais restent inactifs
// tant qu'ils ne sont pas pleinement configurés (opérateurs, catégories, formats de relevés).
export const COUNTRIES: Record<CountryCode, Country> = {
  BF: { code: 'BF', label: 'Burkina Faso', currency: 'XOF', phonePrefix: '+226' },
  CI: { code: 'CI', label: "Côte d'Ivoire", currency: 'XOF', phonePrefix: '+225' },
  SN: { code: 'SN', label: 'Sénégal', currency: 'XOF', phonePrefix: '+221' },
  ML: { code: 'ML', label: 'Mali', currency: 'XOF', phonePrefix: '+223' },
};

export const LAUNCH_COUNTRY: CountryCode = 'BF';
