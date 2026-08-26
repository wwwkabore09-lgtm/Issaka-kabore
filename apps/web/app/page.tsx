'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAccessToken } from '@/lib/auth-session';

const DOMAINS = [
  { title: 'Comptes', description: 'Mobile Money, comptes bancaires et espèces, réunis au même endroit.' },
  { title: 'Budgets', description: 'Un plafond par catégorie, suivi en temps réel sur vos dépenses.' },
  { title: "Objectifs d'épargne", description: 'Des cibles claires, des contributions qui font avancer la barre.' },
  { title: 'Dettes et créances', description: "Ce que vous devez, et ce qu'on vous doit — sans le perdre de vue." },
  { title: 'Abonnements', description: 'Vos paiements récurrents ramenés à un coût mensuel comparable.' },
  { title: 'Famille', description: 'Partagez un compte en un clic — jamais visible sans votre accord.' },
];

export default function HomePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (getStoredAccessToken()) {
      router.replace('/comptes');
      return;
    }
    setCheckingSession(false);
  }, [router]);

  if (checkingSession) return null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-16 px-6 py-16">
      <section className="flex flex-col items-center gap-5 text-center">
        <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          Lancement au Burkina Faso
        </span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight">
          Le Financial OS pensé pour vos réalités : Mobile Money, famille, imprévus.
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Orange Money, Wave, comptes bancaires et espèces réunis au même endroit. Budgets,
          objectifs d&apos;épargne, dettes et abonnements suivis sans effort — seul ou en famille.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/inscription"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Créer un compte gratuitement
          </Link>
          <Link
            href="/connexion"
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Se connecter
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DOMAINS.map((domain) => (
          <div key={domain.title} className="rounded-lg border border-border p-4">
            <h2 className="font-medium">{domain.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{domain.description}</p>
          </div>
        ))}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Vos identifiants Mobile Money et bancaires ne sont jamais demandés — Finza suit vos
        finances, il ne s&apos;y connecte pas.
      </p>
    </main>
  );
}
