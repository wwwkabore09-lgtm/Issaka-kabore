'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@finza/ui';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/comptes', label: 'Comptes' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/objectifs', label: 'Objectifs' },
  { href: '/dettes', label: 'Dettes' },
  { href: '/abonnements', label: 'Abonnements' },
  { href: '/rapports', label: 'Rapports' },
  { href: '/famille', label: 'Famille' },
] as const;

// Barre de navigation partagée entre toutes les pages authentifiées : toujours visible
// (sticky) pour passer d'un domaine à l'autre en un clic, plutôt que de devoir repasser
// par Comptes à chaque fois. L'onglet actif se déduit du chemin (pathname) au lieu d'être
// passé en prop par chaque page, pour ne jamais désynchroniser l'un des deux.
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 -mt-8 mb-4 bg-background/95 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex gap-1.5 overflow-x-auto border-b border-border pb-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
