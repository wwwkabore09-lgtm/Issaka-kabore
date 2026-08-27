'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HandCoins } from 'lucide-react';
import type { AccountDto, DebtDirection, DebtPaymentDto, DebtProgressDto } from '@finza/shared-types';
import { DEBT_DIRECTIONS } from '@finza/shared-types';
import { cn } from '@finza/ui';
import {
  addDebtPayment,
  createDebt,
  deleteDebt,
  listAccounts,
  listDebtPayments,
  listDebts,
  updateDebt,
} from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';

const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  debt: 'Je dois',
  credit: 'On me doit',
};

function formatXof(value: string) {
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

export default function DettesPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [debts, setDebts] = useState<DebtProgressDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [filter, setFilter] = useState<DebtDirection | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState<DebtDirection>('debt');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [payments, setPayments] = useState<DebtPaymentDto[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCounterpartyName, setEditCounterpartyName] = useState('');
  const [editPrincipalAmount, setEditPrincipalAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
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

  const visibleDebts = useMemo(
    () => (filter === 'all' ? debts : debts.filter((d) => d.type === filter)),
    [debts, filter],
  );

  async function refreshAll() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [debtsRes, accountsRes] = await Promise.all([listDebts(accessToken), listAccounts(accessToken)]);
      setDebts(debtsRes);
      setAccounts(accountsRes);
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
      await createDebt(accessToken, {
        type,
        counterpartyName,
        principalAmount,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        accountId: accountId || undefined,
      });
      setCounterpartyName('');
      setPrincipalAmount('');
      setDueDate('');
      setAccountId('');
      toast.success(type === 'debt' ? 'Dette ajoutée.' : 'Créance ajoutée.');
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(d: DebtProgressDto) {
    setEditingId(d.debtId);
    setEditCounterpartyName(d.counterpartyName);
    setEditPrincipalAmount(d.principalAmount);
    setEditDueDate(d.dueDate ? d.dueDate.slice(0, 10) : '');
  }

  async function handleSaveEdit(debtId: string) {
    if (!accessToken) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateDebt(debtId, accessToken, {
        counterpartyName: editCounterpartyName,
        principalAmount: editPrincipalAmount,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : undefined,
      });
      setEditingId(null);
      toast.success('Entrée modifiée.');
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handlePay(debtId: string) {
    if (!accessToken) return;
    const amount = paymentAmounts[debtId];
    if (!amount) return;
    setError(null);
    try {
      await addDebtPayment(debtId, accessToken, { amount });
      setPaymentAmounts((prev) => ({ ...prev, [debtId]: '' }));
      toast.success('Paiement enregistré.');
      await refreshAll();
      if (expandedDebtId === debtId) {
        setPayments(await listDebtPayments(debtId, accessToken));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    }
  }

  async function handleDelete(debt: DebtProgressDto) {
    if (!accessToken) return;
    const ok = await confirm({
      title: `Supprimer « ${debt.counterpartyName} » ?`,
      description: 'Tous les paiements associés seront définitivement supprimés.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteDebt(debt.debtId, accessToken);
      if (expandedDebtId === debt.debtId) setExpandedDebtId(null);
      toast.success('Entrée supprimée.');
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    }
  }

  async function toggleHistory(debtId: string) {
    if (!accessToken) return;
    if (expandedDebtId === debtId) {
      setExpandedDebtId(null);
      return;
    }
    setExpandedDebtId(debtId);
    try {
      setPayments(await listDebtPayments(debtId, accessToken));
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
        <h1 className="text-2xl font-semibold">Dettes et créances</h1>
        <p className="text-sm text-muted-foreground">Ce que vous devez, et ce qu&apos;on vous doit.</p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="font-medium">Nouvelle entrée</h2>

        <div className="flex items-center gap-4 text-sm">
          {DEBT_DIRECTIONS.map((value) => (
            <label key={value} className="flex items-center gap-1.5">
              <input type="radio" name="type" checked={type === value} onChange={() => setType(value)} />
              {DEBT_DIRECTION_LABELS[value]}
            </label>
          ))}
        </div>

        <label htmlFor="debt-name" className="sr-only">
          Nom
        </label>
        <input
          id="debt-name"
          value={counterpartyName}
          onChange={(event) => setCounterpartyName(event.target.value)}
          placeholder="Nom (ex: Boubacar)"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="debt-amount" className="text-xs text-muted-foreground">
              Montant
            </label>
            <input
              id="debt-amount"
              value={principalAmount}
              onChange={(event) => setPrincipalAmount(event.target.value)}
              inputMode="decimal"
              required
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="debt-due-date" className="text-xs text-muted-foreground">
              Échéance (optionnel)
            </label>
            <input
              id="debt-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label htmlFor="debt-account" className="sr-only">
          Compte lié
        </label>
        <select
          id="debt-account"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Aucun compte lié</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

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

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Vos entrées {loading && '(chargement…)'}</h2>
          <div className="flex gap-1 text-xs">
            {(['all', ...DEBT_DIRECTIONS] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  'rounded-full px-2.5 py-1',
                  filter === value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {value === 'all' ? 'Tout' : DEBT_DIRECTION_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        {!loading && visibleDebts.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
            <HandCoins className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Aucune dette ni créance enregistrée</p>
            <p className="text-sm text-muted-foreground">Ajoutez votre première entrée pour la suivre ici.</p>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {visibleDebts.map((d) => {
            const isEditing = editingId === d.debtId;
            return (
              <li key={d.debtId} className="rounded-lg border border-border p-4">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <label htmlFor={`edit-debt-name-${d.debtId}`} className="text-xs text-muted-foreground">
                      Nom
                    </label>
                    <input
                      id={`edit-debt-name-${d.debtId}`}
                      value={editCounterpartyName}
                      onChange={(event) => setEditCounterpartyName(event.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`edit-debt-amount-${d.debtId}`} className="text-xs text-muted-foreground">
                          Montant
                        </label>
                        <input
                          id={`edit-debt-amount-${d.debtId}`}
                          value={editPrincipalAmount}
                          onChange={(event) => setEditPrincipalAmount(event.target.value)}
                          inputMode="decimal"
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`edit-debt-date-${d.debtId}`} className="text-xs text-muted-foreground">
                          Échéance
                        </label>
                        <input
                          id={`edit-debt-date-${d.debtId}`}
                          type="date"
                          value={editDueDate}
                          onChange={(event) => setEditDueDate(event.target.value)}
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(d.debtId)}
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
                      <p className="font-medium">
                        {d.counterpartyName}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({DEBT_DIRECTION_LABELS[d.type]})
                        </span>{' '}
                        {d.isSettled && <span className="text-primary">✓ Soldé</span>}
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(d)}
                          className="text-xs text-muted-foreground underline"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d)}
                          className="text-xs text-destructive underline"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatXof(d.paidAmount)} / {formatXof(d.principalAmount)}
                      {d.dueDate ? ` · échéance ${new Date(d.dueDate).toLocaleDateString('fr-FR')}` : ''}
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', d.isSettled ? 'bg-primary' : 'bg-primary/70')}
                        style={{ width: `${Math.min(d.percentage, 100)}%` }}
                      />
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <label htmlFor={`payment-${d.debtId}`} className="sr-only">
                        {d.type === 'debt' ? 'Enregistrer un remboursement' : 'Enregistrer un versement reçu'}
                      </label>
                      <input
                        id={`payment-${d.debtId}`}
                        value={paymentAmounts[d.debtId] ?? ''}
                        onChange={(event) => setPaymentAmounts((prev) => ({ ...prev, [d.debtId]: event.target.value }))}
                        placeholder={d.type === 'debt' ? 'Enregistrer un remboursement' : 'Enregistrer un versement reçu'}
                        inputMode="decimal"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handlePay(d.debtId)}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                      >
                        Ajouter
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleHistory(d.debtId)}
                        className="text-xs text-muted-foreground underline"
                      >
                        {expandedDebtId === d.debtId ? 'Masquer' : 'Historique'}
                      </button>
                    </div>

                    {expandedDebtId === d.debtId && (
                      <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
                        {payments.length === 0 && <li className="text-xs text-muted-foreground">Aucun paiement.</li>}
                        {payments.map((p) => (
                          <li key={p.id} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              {new Date(p.paidAt).toLocaleDateString('fr-FR')} {p.note ? `· ${p.note}` : ''}
                            </span>
                            <span>{formatXof(p.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
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
