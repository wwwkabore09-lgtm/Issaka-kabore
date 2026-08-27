import type { HTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export type BadgeTone = 'success' | 'danger' | 'muted' | 'warning' | 'primary';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-primary/10 text-primary',
  danger: 'bg-destructive/10 text-destructive',
  muted: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  primary: 'bg-primary text-primary-foreground',
};

// Pastille de statut — remplace les chaînes de classes dupliquées pour "Payé/Échoué/En
// attente", "Actif/Expiré", "Revenu/Dépense/Transfert", etc. répétées sur chaque page.
export function Badge({ className, tone = 'muted', ...props }: BadgeProps) {
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', TONE_CLASSES[tone], className)} {...props} />;
}
