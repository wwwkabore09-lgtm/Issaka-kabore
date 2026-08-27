import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// Un seul gabarit d'état vide pour toute l'application — avant ce composant, chaque page
// dupliquait "flex flex-col items-center gap-N rounded-lg border border-dashed border-border
// p-N text-center" avec des valeurs de gap/padding légèrement différentes d'une page à
// l'autre. Toujours accompagné d'une explication et, quand une action existe, d'un moyen
// direct de la déclencher — jamais un écran vide sans contexte.
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center', className)}>
      {Icon && <Icon className="h-10 w-10 text-muted-foreground" aria-hidden="true" />}
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
