import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// "danger" et "link" s'insèrent dans une ligne de texte (ex: "Modifier · Supprimer" sous une
// ligne de liste) — jamais de padding ni de fond, contrairement aux vrais boutons.
const INLINE_TEXT_VARIANTS: ButtonVariant[] = ['danger', 'link'];

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted',
  ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted',
  danger: 'text-destructive underline underline-offset-2 hover:opacity-75',
  link: 'text-muted-foreground underline underline-offset-2 hover:text-foreground',
};

const SIZE_CLASSES: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' },
  secondary: { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' },
  ghost: { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' },
  danger: { sm: 'text-xs', md: 'text-sm' },
  link: { sm: 'text-xs', md: 'text-sm' },
};

// Composant central pour toute action de l'application : avant ce composant, chaque page
// dupliquait sa propre chaîne de classes bouton, avec de légères variations de padding
// (px-3 py-1 vs px-3 py-1.5, text-xs vs text-sm) qui rendaient l'interface incohérente.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', disabled, ...props }, ref) => {
    const isInlineText = INLINE_TEXT_VARIANTS.includes(variant);
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          !isInlineText && 'rounded-md',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[variant][size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
