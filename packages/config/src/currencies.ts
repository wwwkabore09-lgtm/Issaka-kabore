export type CurrencyCode = 'XOF' | 'XAF' | 'GHS' | 'NGN';

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
};
