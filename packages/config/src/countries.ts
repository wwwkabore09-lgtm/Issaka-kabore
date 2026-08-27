import type { CurrencyCode } from './currencies';

export type CountryCode = 'BF' | 'CI' | 'SN' | 'ML' | 'TG' | 'BJ' | 'FR' | 'CA';

export interface Country {
  code: CountryCode;
  label: string;
  currency: CurrencyCode;
  phonePrefix: string;
}

// Le Burkina Faso est le seul pays pleinement onboardé (opérateurs, catégories, formats de
// relevés) — voir LAUNCH_COUNTRY et DEFAULT_CATEGORIES. Les autres entrées ci-dessous sont
// tout de même de vrais pays utilisables comme profil utilisateur (ex: pour l'assistant IA,
// qui a besoin de connaître le pays/la devise réels de la personne sans jamais en inventer) :
// ajouter un pays ici ne suppose pas qu'il soit prêt pour l'inscription/le lancement complet.
export const COUNTRIES: Record<CountryCode, Country> = {
  BF: { code: 'BF', label: 'Burkina Faso', currency: 'XOF', phonePrefix: '+226' },
  CI: { code: 'CI', label: "Côte d'Ivoire", currency: 'XOF', phonePrefix: '+225' },
  SN: { code: 'SN', label: 'Sénégal', currency: 'XOF', phonePrefix: '+221' },
  ML: { code: 'ML', label: 'Mali', currency: 'XOF', phonePrefix: '+223' },
  TG: { code: 'TG', label: 'Togo', currency: 'XOF', phonePrefix: '+228' },
  BJ: { code: 'BJ', label: 'Bénin', currency: 'XOF', phonePrefix: '+229' },
  FR: { code: 'FR', label: 'France', currency: 'EUR', phonePrefix: '+33' },
  CA: { code: 'CA', label: 'Canada', currency: 'CAD', phonePrefix: '+1' },
};

export const LAUNCH_COUNTRY: CountryCode = 'BF';
