import type { RevenueCategory, RevenueFrequency } from '@finza/shared-types';

export const REVENUE_CATEGORY_LABELS: Record<RevenueCategory, string> = {
  salaire: 'Salaire',
  activite_professionnelle: 'Activité professionnelle',
  commerce: 'Commerce',
  freelance: 'Freelance',
  argent_de_poche: 'Argent de poche',
  revenu_secondaire: 'Revenu secondaire',
  autre: 'Autre',
};

export const REVENUE_FREQUENCY_LABELS: Record<RevenueFrequency, string> = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
  variable: 'Variable',
};
