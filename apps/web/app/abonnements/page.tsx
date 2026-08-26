'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { BillingFrequency, SubscriptionDto, SubscriptionsSummaryDto } from '@finza/shared-types';
import { BILLING_FREQUENCIES } from '@finza/shared-types';
import { cn } from '@finza/ui';
import {
  createSubscription,
  deleteSubscription,
  getSubscriptionsSummary,
  listSubscriptions,
  renewSubscription,
  updateSubscription,
} from '@/lib/api';

const USER_ID_STORAGE_KEY = 'finza_demo_user_id';

const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
};

function formatXof(value: string) {
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

function formatDaysUntil(days: number) {
  if (days < 0) return `en retard de ${Math.abs(days)} j`;
  if (days === 0) return "aujourd'hui";
  return `dans ${days} j`;
}

export default function AbonnementsPage() {
  const [userId, setUserId] = useState('');
  const [subscriptions, setSubscriptions] = useState<SubscriptionDto[]>([]);
  const [summary, setSummary] = useState<SubscriptionsSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (stored) setUserId(stored);
  }, []);

  useEffect(() => {
    if (!userId) return;
    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [subsRes, summaryRes] = await Promise.all([listSubscriptions(userId), getSubscriptionsSummary(userId)]);
      setSubscriptions(subsRes);
      setSummary(summaryRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSubscription({
        userId,
        name,
        amount,
        billingFrequency,
        nextBillingDate: new Date(nextBillingDate).toISOString(),
      });
      setName('');
      setAmount('');
      setNextBillingDate('');
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRenew(id: string) {
    setError(null);
    try {
      await renewSubscription(id, userId);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function handleToggleActive(subscription: SubscriptionDto) {
    setError(null);
    try {
      await updateSubscription(subscription.id, userId, { isActive: !subscription.isActive });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteSubscription(id, userId);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <div>
        <Link href="/comptes" className="text-xs text-muted-foreground underline">
          ← Comptes
        </Link>
        <h1 className="text-2xl font-semibold">Abonnements</h1>
        <p className="text-sm text-muted-foreground">Paiements récurrents, ramenés à un coût mensuel comparable.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="userId" className="text-sm font-medium">
          Identifiant utilisateur
        </label>
        <input
          id="userId"
          value={userId}
          onChange={(event) => setUserId(event.target.value.trim())}
          placeholder="uuid — via npm run prisma:seed --workspace=apps/api"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {summary && (
        <div className="rounded-lg border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">Total récurrent mensuel ({summary.activeCount} actif(s))</p>
          <p className="text-xl font-semibold">{formatXof(summary.totalMonthlyRecurring)}</p>
        </div>
      )}

      {userId && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-medium">Nouvel abonnement</h2>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom (ex: Netflix)"
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Montant par cycle"
              inputMode="decimal"
              required
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <select
              value={billingFrequency}
              onChange={(event) => setBillingFrequency(event.target.value as BillingFrequency)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {BILLING_FREQUENCIES.map((value) => (
                <option key={value} value={value}>
                  {BILLING_FREQUENCY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <input
            type="date"
            value={nextBillingDate}
            onChange={(event) => setNextBillingDate(event.target.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity',
              submitting && 'opacity-60',
            )}
          >
            {submitting ? 'Création…' : 'Ajouter'}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Vos abonnements {loading && '(chargement…)'}</h2>

        {userId && !loading && subscriptions.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun abonnement pour le moment.</p>
        )}

        <ul className="flex flex-col gap-2">
          {subscriptions.map((s) => (
            <li
              key={s.id}
              className={cn('rounded-lg border border-border p-3', !s.isActive && 'opacity-50')}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{s.name}</p>
                <span className="font-medium">{formatXof(s.amount)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {BILLING_FREQUENCY_LABELS[s.billingFrequency]} · {formatXof(s.monthlyEquivalent)}/mois équiv. · prochaine
                échéance {formatDaysUntil(s.daysUntilNextBilling)}
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs">
                <button type="button" onClick={() => handleRenew(s.id)} className="text-primary underline">
                  Renouveler
                </button>
                <button type="button" onClick={() => handleToggleActive(s)} className="text-muted-foreground underline">
                  {s.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
                <button type="button" onClick={() => handleDelete(s.id)} className="text-muted-foreground underline">
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
