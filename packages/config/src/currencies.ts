export type CurrencyCode = 'XOF' | 'XAF' | 'GHS' | 'NGN' | 'EUR' | 'CAD';

export interface Currency {
  code: CurrencyCode;
  label: string;
  symbol: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  XOF: { code: 'XOF', label: 'Franc CFA (UEMOA)', symbol: 'FCFA', decimals: 0 },
  XAF: { code: 'XAF', label: 'Franc CFA (CEMAC)', symbol: 'FCFA', decimals: 0 },
  GHS: { code: 'GHS', label: 'Cedi ghanéen', symbol: 'GH₵', decimals: 2 },
  NGN: { code: 'NGN', label: 'Naira nigérian', symbol: '₦', decimals: 2 },
  EUR: { code: 'EUR', label: 'Euro', symbol: '€', decimals: 2 },
  CAD: { code: 'CAD', label: 'Dollar canadien', symbol: '$', decimals: 2 },
};
