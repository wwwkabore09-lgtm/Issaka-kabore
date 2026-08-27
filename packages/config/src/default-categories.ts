import type { CountryCode } from './countries';

export type TransactionKind = 'income' | 'expense';

export interface DefaultCategory {
  key: string;
  label: string;
  kind: TransactionKind;
}

// Catégories par défaut proposées à la création d'un compte, par pays.
// L'utilisateur peut les personnaliser ; ce set n'est qu'un point de départ.
export const DEFAULT_CATEGORIES: Record<CountryCode, DefaultCategory[]> = {
  BF: [
    { key: 'salaire', label: 'Salaire', kind: 'income' },
    { key: 'commerce', label: 'Commerce / Activité', kind: 'income' },
    { key: 'transferts_recus', label: 'Transferts reçus', kind: 'income' },
    { key: 'alimentation', label: 'Alimentation', kind: 'expense' },
    { key: 'transport', label: 'Transport', kind: 'expense' },
    { key: 'logement', label: 'Logement', kind: 'expense' },
    { key: 'sante', label: 'Santé', kind: 'expense' },
    { key: 'education', label: 'Éducation', kind: 'expense' },
    { key: 'famille', label: 'Soutien familial', kind: 'expense' },
    { key: 'mobile_credit', label: 'Crédit / Forfait mobile', kind: 'expense' },
  ],
  CI: [],
  SN: [],
  ML: [],
  TG: [],
  BJ: [],
  FR: [],
  CA: [],
};
