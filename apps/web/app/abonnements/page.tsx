'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { getStoredAccessToken } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';

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
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionDto[]>([]);
  const [summary, setSummary] = useState<SubscriptionsSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editFrequency, setEditFrequency] = useState<BillingFrequency>('monthly');
  const [editNextBillingDate, setEditNextBillingDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function refreshAll() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [subsRes, summaryRes] = await Promise.all([
        listSubscriptions(accessToken),
        getSubscriptionsSummary(accessToken),
      ]);
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
    if (!accessToken) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSubscription(accessToken, {
        name,
        amount,
        billingFrequency,
        nextBillingDate: new Date(nextBillingDate).toISOString(),
      });
      setName('');
      setAmount('');
      setNextBillingDate('');
      toast.success('Abonnement ajouté.');
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(s: SubscriptionDto) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditAmount(s.amount);
    setEditFrequency(s.billingFrequency);
    setEditNextBillingDate(s.nextBillingDate.slice(0, 10));
  }

  async function handleSaveEdit(id: string) {
    if (!accessToken) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateSubscription(id, accessToken, {
        name: editName,
        amount: editAmount,
        billingFrequency: editFrequency,
        nextBillingDate: editNextBillingDate ? new Date(editNextBillingDate).toISOString() : undefined,
      });
      setEditingId(null);
      toast.success('Abonnement modifié.');
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRenew(id: string) {
    if (!accessToken) return;
    setError(null);
    try {
      await renewSubscription(id, accessToken);
      toast.success('Échéance mise à jour.');
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    }
  }

  async function handleToggleActive(subscription: SubscriptionDto) {
    if (!accessToken) return;
    setError(null);
    try {
      await updateSubscription(subscription.id, accessToken, { isActive: !subscription.isActive });
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    }
  }

  async function handleDelete(subscription: SubscriptionDto) {
    if (!accessToken) return;
    const ok = await confirm({
      title: `Supprimer « ${subscription.name} » ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteSubscription(subscription.id, accessToken);
      toast.success('Abonnement supprimé.');
      await refreshAll();
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
        <h1 className="text-2xl font-semibold">Abonnements</h1>
        <p className="text-sm text-muted-foreground">Paiements récurrents, ramenés à un coût mensuel comparable.</p>
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

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="font-medium">Nouvel abonnement</h2>

        <label htmlFor="sub-name" className="sr-only">
          Nom
        </label>
        <input
          id="sub-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nom (ex: Netflix)"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="sub-amount" className="text-xs text-muted-foreground">
              Montant par cycle
            </label>
            <input
              id="sub-amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              required
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sub-frequency" className="text-xs text-muted-foreground">
              Fréquence
            </label>
            <select
              id="sub-frequency"
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
        </div>

        <label htmlFor="sub-next-billing" className="text-xs text-muted-foreground">
          Prochaine échéance
        </label>
        <input
          id="sub-next-billing"
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

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Vos abonnements {loading && '(chargement…)'}</h2>

        {!loading && subscriptions.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
            <p className="font-medium">Aucun abonnement enregistré</p>
            <p className="text-sm text-muted-foreground">
              Ajoutez vos paiements récurrents pour suivre leur coût mensuel total.
            </p>
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {subscriptions.map((s) => {
            const isEditing = editingId === s.id;
            return (
              <li key={s.id} className={cn('rounded-lg border border-border p-3', !s.isActive && 'opacity-50')}>
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <label htmlFor={`edit-sub-name-${s.id}`} className="text-xs text-muted-foreground">
                      Nom
                    </label>
                    <input
                      id={`edit-sub-name-${s.id}`}
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`edit-sub-amount-${s.id}`} className="text-xs text-muted-foreground">
                          Montant
                        </label>
                        <input
                          id={`edit-sub-amount-${s.id}`}
                          value={editAmount}
                          onChange={(event) => setEditAmount(event.target.value)}
                          inputMode="decimal"
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`edit-sub-freq-${s.id}`} className="text-xs text-muted-foreground">
                          Fréquence
                        </label>
                        <select
                          id={`edit-sub-freq-${s.id}`}
                          value={editFrequency}
                          onChange={(event) => setEditFrequency(event.target.value as BillingFrequency)}
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        >
                          {BILLING_FREQUENCIES.map((value) => (
                            <option key={value} value={value}>
                              {BILLING_FREQUENCY_LABELS[value]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`edit-sub-date-${s.id}`} className="text-xs text-muted-foreground">
                          Échéance
                        </label>
                        <input
                          id={`edit-sub-date-${s.id}`}
                          type="date"
                          value={editNextBillingDate}
                          onChange={(event) => setEditNextBillingDate(event.target.value)}
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(s.id)}
                        className={cn(
                          'rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground',
                          savingEdit && 'opacity-60',
                        )}
                      >
                        {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{s.name}</p>
                      <span className="font-medium">{formatXof(s.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {BILLING_FREQUENCY_LABELS[s.billingFrequency]} · {formatXof(s.monthlyEquivalent)}/mois équiv. ·
                      prochaine échéance {formatDaysUntil(s.daysUntilNextBilling)}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <button type="button" onClick={() => handleRenew(s.id)} className="text-primary underline">
                        Renouveler
                      </button>
                      <button type="button" onClick={() => startEdit(s)} className="text-muted-foreground underline">
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s)}
                        className="text-muted-foreground underline"
                      >
                        {s.isActive ? 'Désactiver' : 'Réactiver'}
                      </button>
                      <button type="button" onClick={() => handleDelete(s)} className="text-destructive underline">
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
