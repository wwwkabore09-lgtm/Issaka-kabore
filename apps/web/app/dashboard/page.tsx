'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { AccountDto, DashboardOverviewDto, SavingsOverviewDto } from '@finza/shared-types';
import { COUNTRIES, CURRENCIES, LAUNCH_COUNTRY } from '@finza/config';
import { cn } from '@finza/ui';
import { getDashboardOverview, getSavingsOverview, listAccounts } from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { MonthlyBarChart } from '@/components/charts/monthly-bar-chart';
import { CategoryBarList } from '@/components/charts/category-bar-list';

const DEFAULT_CURRENCY = COUNTRIES[LAUNCH_COUNTRY].currency;

// Validées avec le vérificateur de palette dataviz (ΔE CVD 8.6, bandes de luminosité et
// contraste OK en clair comme en sombre) : distinctes des tokens --primary/--destructive
// des boutons, choisies spécifiquement pour la lisibilité en graphique.
const CHART_COLOR_INCOME = '#059669';
const CHART_COLOR_EXPENSE = '#dc2626';
const CHART_COLOR_SAVINGS = '#059669';

function formatAmount(value: string | number, currency: string) {
  const symbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? currency;
  return `${Number(value).toLocaleString('fr-FR')} ${symbol}`;
}

function evolution(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function EvolutionBadge({ value, invertColors = false }: { value: number | null; invertColors?: boolean }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const isGood = invertColors ? value <= 0 : value >= 0;
  return (
    <span className={cn('text-xs font-medium', isGood ? 'text-primary' : 'text-destructive')}>
      {value > 0 ? '+' : ''}
      {value.toLocaleString('fr-FR')} % vs mois dernier
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [savings, setSavings] = useState<SavingsOverviewDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    void refreshAll(accessToken);
  }, [accessToken]);

  async function refreshAll(token: string) {
    setLoading(true);
    setError(null);
    try {
      const [accountsRes, overviewRes, savingsRes] = await Promise.all([
        listAccounts(token),
        getDashboardOverview(token),
        getSavingsOverview(token),
      ]);
      setAccounts(accountsRes);
      setOverview(overviewRes);
      setSavings(savingsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  const solde = useMemo(() => accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0), [accounts]);
  const hasAnyMovement = useMemo(
    () => (overview ? overview.monthlySeries.some((p) => Number(p.totalIncome) > 0 || Number(p.totalExpense) > 0) : false),
    [overview],
  );

  if (!accessToken) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
      </main>
    );
  }

  const revenueEvolution = overview
    ? evolution(Number(overview.currentMonth.totalIncome), Number(overview.previousMonth.totalIncome))
    : null;
  const expenseEvolution = overview
    ? evolution(Number(overview.currentMonth.totalExpense), Number(overview.previousMonth.totalExpense))
    : null;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <AppNav />
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Votre situation financière, en un coup d&apos;œil.</p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-lg font-medium">Bienvenue sur Finza</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ajoutez votre première source de revenus pour commencer à suivre vos finances — votre tableau de bord se
            remplira automatiquement.
          </p>
          <Link
            href="/comptes"
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ajouter un revenu
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                Revenus (mois)
              </div>
              <p className="text-lg font-semibold">{overview ? formatAmount(overview.currentMonth.totalIncome, DEFAULT_CURRENCY) : '—'}</p>
              <EvolutionBadge value={revenueEvolution} />
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                Dépenses (mois)
              </div>
              <p className="text-lg font-semibold">{overview ? formatAmount(overview.currentMonth.totalExpense, DEFAULT_CURRENCY) : '—'}</p>
              <EvolutionBadge value={expenseEvolution} invertColors />
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                Solde
              </div>
              <p className="text-lg font-semibold">{formatAmount(solde, DEFAULT_CURRENCY)}</p>
              <p className="text-xs text-muted-foreground">Tous comptes confondus</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PiggyBank className="h-3.5 w-3.5" aria-hidden="true" />
                Épargne (mois)
              </div>
              <p className="text-lg font-semibold">{savings ? formatAmount(savings.currentMonthTotal, DEFAULT_CURRENCY) : '—'}</p>
              <p className="text-xs text-muted-foreground">Contributions à vos objectifs</p>
            </div>
          </div>

          {!hasAnyMovement ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
              <p className="font-medium">Aucune transaction enregistrée</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ajoutez votre première transaction pour voir vos graphiques se remplir.
              </p>
              <Link href="/transactions" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Ajouter une transaction
              </Link>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border p-4">
                <h2 className="mb-4 font-medium">Revenus et dépenses par mois</h2>
                {overview && (
                  <MonthlyBarChart
                    points={overview.monthlySeries.map((p) => ({
                      month: p.month,
                      values: { income: Number(p.totalIncome), expense: Number(p.totalExpense) },
                    }))}
                    series={[
                      { key: 'income', label: 'Revenus', color: CHART_COLOR_INCOME },
                      { key: 'expense', label: 'Dépenses', color: CHART_COLOR_EXPENSE },
                    ]}
                    currency={DEFAULT_CURRENCY}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <h2 className="mb-4 font-medium">Répartition des dépenses (mois courant)</h2>
                  {overview && overview.expenseByCategory.length > 0 ? (
                    <CategoryBarList
                      items={overview.expenseByCategory.map((c) => ({ label: c.categoryLabel, total: Number(c.total) }))}
                      currency={DEFAULT_CURRENCY}
                      color={CHART_COLOR_EXPENSE}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune dépense ce mois-ci.</p>
                  )}
                </div>

                <div className="rounded-lg border border-border p-4">
                  <h2 className="mb-4 font-medium">Évolution de l&apos;épargne</h2>
                  {savings && (
                    <MonthlyBarChart
                      points={savings.monthlySeries.map((p) => ({ month: p.month, values: { savings: Number(p.total) } }))}
                      series={[{ key: 'savings', label: 'Épargne', color: CHART_COLOR_SAVINGS }]}
                      currency={DEFAULT_CURRENCY}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
