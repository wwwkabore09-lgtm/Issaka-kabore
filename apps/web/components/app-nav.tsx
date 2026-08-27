'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@finza/ui';
import { getMe } from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/comptes', label: 'Comptes' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/objectifs', label: 'Objectifs' },
  { href: '/dettes', label: 'Dettes' },
  { href: '/abonnements', label: 'Abonnements' },
  { href: '/rapports', label: 'Rapports' },
  { href: '/famille', label: 'Famille' },
  { href: '/assistant', label: 'Assistant IA' },
  { href: '/subscription', label: 'Premium' },
  { href: '/profil', label: 'Profil' },
] as const;

const ADMIN_ITEM = { href: '/admin/abonnements', label: 'Admin' } as const;

// Barre de navigation partagée entre toutes les pages authentifiées : toujours visible
// (sticky) pour passer d'un domaine à l'autre en un clic, plutôt que de devoir repasser
// par Comptes à chaque fois. L'onglet actif se déduit du chemin (pathname) au lieu d'être
// passé en prop par chaque page, pour ne jamais désynchroniser l'un des deux.
export function AppNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;
    // Purement pour afficher/masquer le lien Admin — les routes admin elles-mêmes
    // revérifient le rôle côté serveur à chaque requête (AdminGuard), jamais sur la seule
    // foi de cet appel.
    getMe(token)
      .then((me) => setIsAdmin(me.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return (
    <nav className="sticky top-0 z-10 -mt-8 mb-4 bg-background/95 pt-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex gap-1.5 overflow-x-auto border-b border-border pb-3">
        {items.map((item) => {
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
