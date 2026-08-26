'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReportDto } from '@finza/shared-types';
import { cn } from '@finza/ui';
import { deleteReport, generateReport, listReports } from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';

function formatXof(value: string) {
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

export default function RapportsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportDto[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredAccessToken();
    if (!stored) {
      router.replace('/connexion');
      return;
    }
    setAccessToken(stored);
  }, [router]);

  useEffect(() => {
    if (!accessToken) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function refresh() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setReports(await listReports(accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setGenerating(true);
    setError(null);
    try {
      const report = await generateReport(accessToken, { title: title || undefined });
      setTitle('');
      setExpandedId(report.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    setError(null);
    try {
      await deleteReport(id, accessToken);
      if (expandedId === id) setExpandedId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  if (!accessToken) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <AppNav />
      <div>
        <h1 className="text-2xl font-semibold">Rapports</h1>
        <p className="text-sm text-muted-foreground">
          Instantané figé de vos finances sur une période — ces chiffres ne bougent plus après génération.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleGenerate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="font-medium">Générer un rapport (mois courant)</h2>
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titre (optionnel)"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={generating}
            className={cn(
              'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity',
              generating && 'opacity-60',
            )}
          >
            {generating ? 'Génération…' : 'Générer'}
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="font-medium">Historique {loading && '(chargement…)'}</h2>

        {!loading && reports.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun rapport généré pour le moment.</p>
        )}

        <ul className="flex flex-col gap-3">
          {reports.map((r) => {
            const expanded = expandedId === r.id;
            return (
              <li key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className="text-left font-medium hover:underline"
                  >
                    {r.title}
                  </button>
                  <button type="button" onClick={() => handleDelete(r.id)} className="text-xs text-muted-foreground underline">
                    Supprimer
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.periodStart).toLocaleDateString('fr-FR')} → {new Date(r.periodEnd).toLocaleDateString('fr-FR')}{' '}
                  · généré le {new Date(r.generatedAt).toLocaleDateString('fr-FR')}
                </p>

                {expanded && (
                  <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 text-sm">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Revenus</p>
                        <p className="font-medium">{formatXof(r.snapshot.cashFlow.totalIncome)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Dépenses</p>
                        <p className="font-medium">{formatXof(r.snapshot.cashFlow.totalExpense)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Net</p>
                        <p className="font-medium">{formatXof(r.snapshot.cashFlow.netFlow)}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Comptes</p>
                      {r.snapshot.accounts.map((a) => (
                        <div key={a.id} className="flex justify-between">
                          <span>{a.name}</span>
                          <span>{formatXof(a.currentBalance)}</span>
                        </div>
                      ))}
                    </div>

                    {r.snapshot.budgets.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Budgets</p>
                        {r.snapshot.budgets.map((b) => (
                          <div key={b.budgetId} className="flex justify-between">
                            <span>{b.categoryLabel}</span>
                            <span>
                              {formatXof(b.spent)} / {formatXof(b.limit)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {r.snapshot.goals.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Objectifs</p>
                        {r.snapshot.goals.map((g) => (
                          <div key={g.goalId} className="flex justify-between">
                            <span>{g.name}</span>
                            <span>
                              {formatXof(g.currentAmount)} / {formatXof(g.targetAmount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {r.snapshot.debts.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Dettes et créances</p>
                        {r.snapshot.debts.map((d) => (
                          <div key={d.debtId} className="flex justify-between">
                            <span>{d.counterpartyName}</span>
                            <span>{formatXof(d.remaining)} restant</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Abonnements ({r.snapshot.subscriptions.activeCount} actif(s))
                      </span>
                      <span>{formatXof(r.snapshot.subscriptions.totalMonthlyRecurring)}/mois</span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
