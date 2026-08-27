import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

// Conteneur bordé standard — remplace "rounded-lg border border-border p-4" dupliqué sur
// chaque page. Volontairement minimal (pas d'ombre, pas de dégradé) : la hiérarchie vient de
// l'espacement et de la typographie, pas d'un effet de carte artificiel.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border p-4', className)} {...props} />;
}
