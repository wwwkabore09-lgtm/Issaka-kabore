'use client';

import { useState } from 'react';
import { CURRENCIES } from '@finza/config';
import { cn } from '@finza/ui';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartPoint {
  month: string; // "YYYY-MM"
  values: Record<string, number>;
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
}

function formatAmount(value: number, currency: string) {
  const symbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? currency;
  return `${value.toLocaleString('fr-FR')} ${symbol}`;
}

// Barres groupées par mois — HTML/CSS plutôt que SVG pour rester naturellement responsive.
// Une seule série n'affiche pas de légende (le titre du graphique suffit) ; deux séries ou
// plus affichent toujours une légende directe, jamais la couleur seule pour porter le sens.
export function MonthlyBarChart({
  points,
  series,
  currency,
}: {
  points: ChartPoint[];
  series: ChartSeries[];
  currency: string;
}) {
  const [hovered, setHovered] = useState<{ monthIndex: number; key: string } | null>(null);
  const max = Math.max(1, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)));

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex h-48 items-end gap-2">
        {points.map((point, i) => (
          <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-40 w-full items-end justify-center gap-0.5">
              {series.map((s) => {
                const value = point.values[s.key] ?? 0;
                const heightPct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
                const isHovered = hovered?.monthIndex === i && hovered.key === s.key;
                return (
                  <div key={s.key} className="relative flex h-full flex-1 items-end">
                    {isHovered && (
                      <div className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background">
                        {formatAmount(value, currency)}
                      </div>
                    )}
                    <div
                      role="img"
                      aria-label={`${s.label}, ${monthLabel(point.month)} : ${formatAmount(value, currency)}`}
                      onMouseEnter={() => setHovered({ monthIndex: i, key: s.key })}
                      onMouseLeave={() => setHovered(null)}
                      className={cn('w-full rounded-t-[4px] transition-opacity', isHovered ? 'opacity-100' : 'opacity-85 hover:opacity-100')}
                      style={{ height: `${heightPct}%`, backgroundColor: s.color }}
                    />
                  </div>
                );
              })}
            </div>
            <span className="text-xs text-muted-foreground">{monthLabel(point.month)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
