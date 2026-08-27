'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote } from 'lucide-react';
import {
  ACCOUNT_OWNERSHIPS,
  REVENUE_CATEGORIES,
  REVENUE_FREQUENCIES,
  type AccountDto,
  type AccountOwnership,
  type RevenueCategory,
  type RevenueFrequency,
  type RevenueOverviewDto,
} from '@finza/shared-types';
import { COUNTRIES, CURRENCIES, LAUNCH_COUNTRY } from '@finza/config';
import { Button, EmptyState, cn } from '@finza/ui';
import {
  createAccount,
  deleteAccount,
  getRevenueOverview,
  listAccounts,
  logout as apiLogout,
  updateAccount,
} from '@/lib/api';
import { REVENUE_CATEGORY_LABELS, REVENUE_FREQUENCY_LABELS } from '@/lib/account-labels';
import { clearSession, getStoredAccessToken, getStoredRefreshToken, getStoredUserEmail } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';

const DEFAULT_CURRENCY = COUNTRIES[LAUNCH_COUNTRY].currency;

function formatAmount(value: string, currency: string) {
  const symbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? currency;
  return `${Number(value).toLocaleString('fr-FR')} ${symbol}`;
}

function formatEvolution(value: string | null) {
  if (value === null) return '—';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n.toLocaleString('fr-FR')} %`;
}

export default function ComptesPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [overview, setOverview] = useState<RevenueOverviewDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RevenueCategory>('salaire');
  const [frequency, setFrequency] = useState<RevenueFrequency>('monthly');
  const [ownership, setOwnership] = useState<AccountOwnership>('personal');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = getStoredAccessToken();
    if (!stored) {
      router.replace('/connexion');
      return;
    }
    setAccessToken(stored);
    setSessionEmail(getStoredUserEmail());
  }, [router]);

  async function handleLogout() {
    const refreshToken = getStoredRefreshToken();
    try {
      if (refreshToken) await apiLogout(refreshToken);
    } catch {
      // Le token est peut-être déjà expiré/révoqué côté serveur — on nettoie quand même localement.
    }
    clearSession();
    router.replace('/connexion');
  }

  useEffect(() => {
    if (!accessToken) return;
    void refreshAll(accessToken);
  }, [accessToken]);

  async function refreshAll(token: string) {
    setLoading(true);
    setError(null);
    try {
      const [accountsRes, overviewRes] = await Promise.all([listAccounts(token), getRevenueOverview(token)]);
      setAccounts(accountsRes);
      setOverview(overviewRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName('');
    setCategory('salaire');
    setFrequency('monthly');
    setOwnership('personal');
    setAmount('');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(account: AccountDto) {
    setEditingId(account.id);
    setName(account.name);
    setCategory(account.category);
    setFrequency(account.frequency);
    setOwnership(account.ownership);
    setAmount('');
    setShowForm(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;

    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        await updateAccount(editingId, accessToken, { name, category, frequency });
        toast.success('Revenu modifié.');
      } else {
        await createAccount(accessToken, {
          name,
          category,
          frequency,
          ownership,
          currency: DEFAULT_CURRENCY,
          openingBalance: amount || undefined,
        });
        toast.success('Revenu ajouté.');
      }
      resetForm();
      await refreshAll(accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(account: AccountDto) {
    if (!accessToken) return;
    setError(null);
    try {
      await updateAccount(account.id, accessToken, { isActive: !account.isActive });
      await refreshAll(accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    }
  }

  async function handleDelete(account: AccountDto) {
    if (!accessToken) return;
    const ok = await confirm({
      title: `Supprimer « ${account.name} » ?`,
      description: "Cette action est définitive. Si cette source a déjà un historique, désactivez-la plutôt.",
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteAccount(account.id, accessToken);
      toast.success('Revenu supprimé.');
      await refreshAll(accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
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
        <h1 className="text-2xl font-semibold">Comptes</h1>
        <p className="text-sm text-muted-foreground">
          Vos revenus, saisis et suivis manuellement — aucune connexion à un service financier externe.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
        <span>
          Connecté : <span className="font-medium">{sessionEmail}</span>
        </span>
        <Button variant="link" size="sm" onClick={handleLogout}>
          Se déconnecter
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ['Aujourd’hui', overview.today],
            ['Cette semaine', overview.thisWeek],
            ['Ce mois', overview.thisMonth],
            ['Cette année', overview.thisYear],
            ['Total', overview.allTime],
            ['Moyenne mensuelle', overview.averageMonthly],
          ] as const).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium">{formatAmount(value, DEFAULT_CURRENCY)}</p>
            </div>
          ))}
          <div className="rounded-lg border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground">Évolution vs mois dernier</p>
            <p
              className={cn(
                'font-medium',
                overview.evolutionVsPreviousMonth !== null &&
                  (Number(overview.evolutionVsPreviousMonth) >= 0 ? 'text-primary' : 'text-destructive'),
              )}
            >
              {formatEvolution(overview.evolutionVsPreviousMonth)}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Mes revenus</h2>
          {!showForm && (
            <Button variant="link" size="sm" onClick={() => setShowForm(true)} className="text-primary hover:text-primary/80">
              + Ajouter un revenu
            </Button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <h3 className="font-medium">{editingId ? 'Modifier ce revenu' : 'Nouveau revenu'}</h3>

            <label htmlFor="revenue-name" className="sr-only">
              Nom
            </label>
            <input
              id="revenue-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nom (ex: Mon activité)"
              required
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />

            {!editingId && (
              <>
                <label htmlFor="revenue-amount" className="sr-only">
                  Montant
                </label>
                <input
                  id="revenue-amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Montant (optionnel, ex: 150000)"
                  inputMode="decimal"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label htmlFor="revenue-category" className="sr-only">
                Catégorie
              </label>
              <select
                id="revenue-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as RevenueCategory)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {REVENUE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {REVENUE_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>

              <label htmlFor="revenue-frequency" className="sr-only">
                Fréquence
              </label>
              <select
                id="revenue-frequency"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as RevenueFrequency)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {REVENUE_FREQUENCIES.map((value) => (
                  <option key={value} value={value}>
                    {REVENUE_FREQUENCY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            {!editingId && (
              <div className="flex items-center gap-4 text-sm">
                {ACCOUNT_OWNERSHIPS.map((value) => (
                  <label key={value} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="ownership"
                      checked={ownership === value}
                      onChange={() => setOwnership(value)}
                    />
                    {value === 'personal' ? 'Personnel' : 'Professionnel'}
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Ajouter'}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                Annuler
              </Button>
            </div>
          </form>
        )}

        {!loading && accounts.length === 0 && !showForm && (
          <EmptyState
            icon={Banknote}
            title="Aucun revenu enregistré"
            description="Ajoutez votre premier revenu pour commencer à suivre vos finances."
            action={<Button onClick={() => setShowForm(true)}>Ajouter un revenu</Button>}
          />
        )}

        <ul className="flex flex-col gap-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className={cn('rounded-lg border border-border p-3', !account.isActive && 'opacity-50')}
            >
              <div className="flex items-center justify-between">
                <Link href={`/comptes/${account.id}`} className="hover:underline">
                  <p className="font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {REVENUE_CATEGORY_LABELS[account.category]} · {REVENUE_FREQUENCY_LABELS[account.frequency]}
                  </p>
                </Link>
                <span className="font-medium">{formatAmount(account.currentBalance, account.currency)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs">
                <Button variant="link" size="sm" onClick={() => startEdit(account)}>
                  Modifier
                </Button>
                <Button variant="link" size="sm" onClick={() => handleToggleActive(account)}>
                  {account.isActive ? 'Désactiver' : 'Réactiver'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(account)}>
                  Supprimer
                </Button>
                <Link href={`/comptes/${account.id}`} className="text-muted-foreground underline">
                  Historique →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
