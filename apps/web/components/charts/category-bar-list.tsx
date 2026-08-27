'use client';

import { CURRENCIES } from '@finza/config';

function formatAmount(value: number, currency: string) {
  const symbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? currency;
  return `${value.toLocaleString('fr-FR')} ${symbol}`;
}

// Répartition par catégorie : une seule teinte (identité déjà portée par le libellé
// directement accolé à chaque barre), jamais une couleur par catégorie.
export function CategoryBarList({
  items,
  currency,
  color,
}: {
  items: { label: string; total: number }[];
  currency: string;
  color: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.total));

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm">{item.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((item.total / max) * 100, 2)}%`, backgroundColor: color }}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-sm font-medium">{formatAmount(item.total, currency)}</span>
        </li>
      ))}
    </ul>
  );
}
