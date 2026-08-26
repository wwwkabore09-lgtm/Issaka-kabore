'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
} from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';

const USER_ID_STORAGE_KEY = 'finza_demo_user_id';

const DEBT_DIRECTION_LABELS: Record<DebtDirection, string> = {
  debt: 'Je dois',
  credit: 'On me doit',
};

function formatXof(value: string) {
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

export default function DettesPage() {
  const [userId, setUserId] = useState('');
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

  const visibleDebts = useMemo(
    () => (filter === 'all' ? debts : debts.filter((d) => d.type === filter)),
    [debts, filter],
  );

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const accessToken = getStoredAccessToken();
      const [debtsRes, accountsRes] = await Promise.all([
        listDebts(userId),
        // Le domaine Comptes exige désormais un vrai token JWT ; sans session connectée,
        // le sélecteur de compte reste simplement vide (les dettes restent utilisables).
        accessToken ? listAccounts(accessToken) : Promise.resolve([]),
      ]);
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
    setSubmitting(true);
    setError(null);
    try {
      await createDebt({
        userId,
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
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePay(debtId: string) {
    const amount = paymentAmounts[debtId];
    if (!amount) return;
    setError(null);
    try {
      await addDebtPayment(debtId, { userId, amount });
      setPaymentAmounts((prev) => ({ ...prev, [debtId]: '' }));
      await refreshAll();
      if (expandedDebtId === debtId) {
        setPayments(await listDebtPayments(debtId, userId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function handleDelete(debtId: string) {
    setError(null);
    try {
      await deleteDebt(debtId, userId);
      if (expandedDebtId === debtId) setExpandedDebtId(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function toggleHistory(debtId: string) {
    if (expandedDebtId === debtId) {
      setExpandedDebtId(null);
      return;
    }
    setExpandedDebtId(debtId);
    try {
      setPayments(await listDebtPayments(debtId, userId));
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
        <h1 className="text-2xl font-semibold">Dettes et créances</h1>
        <p className="text-sm text-muted-foreground">Ce que vous devez, et ce qu&apos;on vous doit.</p>
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

      {userId && (
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

          <input
            value={counterpartyName}
            onChange={(event) => setCounterpartyName(event.target.value)}
            placeholder="Nom (ex: Boubacar)"
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />

          <div className="grid grid-cols-2 gap-3">
            <input
              value={principalAmount}
              onChange={(event) => setPrincipalAmount(event.target.value)}
              placeholder="Montant"
              inputMode="decimal"
              required
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <select
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
      )}

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

        {userId && !loading && visibleDebts.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune entrée.</p>
        )}

        <ul className="flex flex-col gap-3">
          {visibleDebts.map((d) => (
            <li key={d.debtId} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {d.counterpartyName}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({DEBT_DIRECTION_LABELS[d.type]})
                  </span>{' '}
                  {d.isSettled && <span className="text-primary">✓ Soldé</span>}
                </p>
                <button
                  type="button"
                  onClick={() => handleDelete(d.debtId)}
                  className="text-xs text-muted-foreground underline"
                >
                  Supprimer
                </button>
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
                <input
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
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
