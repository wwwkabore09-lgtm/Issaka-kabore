import type { CountryCode } from './countries';

export type MobileMoneyOperator = 'orange_money' | 'moov_money' | 'mtn_money' | 'wave';

export interface OperatorConfig {
  id: MobileMoneyOperator;
  label: string;
  countries: CountryCode[];
}

export const MOBILE_MONEY_OPERATORS: Record<MobileMoneyOperator, OperatorConfig> = {
  orange_money: {
    id: 'orange_money',
    label: 'Orange Money',
    countries: ['BF', 'CI', 'SN', 'ML'],
  },
  moov_money: {
    id: 'moov_money',
    label: 'Moov Money',
    countries: ['BF', 'CI'],
  },
  mtn_money: {
    id: 'mtn_money',
    label: 'MTN Mobile Money',
    countries: ['CI'],
  },
  wave: {
    id: 'wave',
    label: 'Wave',
    countries: ['BF', 'CI', 'SN', 'ML'],
  },
};
