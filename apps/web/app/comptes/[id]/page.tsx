'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { AccountDto, CategoryDto, TransactionDto, TransactionSummaryDto, TransactionType } from '@finza/shared-types';
import { TRANSACTION_TYPES } from '@finza/shared-types';
import { CURRENCIES } from '@finza/config';
import { cn } from '@finza/ui';
import {
  createTransaction,
  getAccount,
  getTransactionSummary,
  listAccounts,
  listCategories,
  listTransactions,
} from '@/lib/api';
import { ACCOUNT_TYPE_LABELS } from '@/lib/account-labels';

const USER_ID_STORAGE_KEY = 'finza_demo_user_id';

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Revenu',
  expense: 'Dépense',
  transfer: 'Transfert',
};

function formatAmount(value: string, currency: string) {
  const symbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? currency;
  return `${Number(value).toLocaleString('fr-FR')} ${symbol}`;
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function endOfMonthIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
}

export default function CompteDetailPage() {
  const params = useParams<{ id: string }>();
  const accountId = params.id;

  const [userId, setUserId] = useState('');
  const [account, setAccount] = useState<AccountDto | null>(null);
  const [otherAccounts, setOtherAccounts] = useState<AccountDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [summary, setSummary] = useState<TransactionSummaryDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transferToAccountId, setTransferToAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (stored) setUserId(stored);
  }, []);

  useEffect(() => {
    if (!userId || !accountId) return;
    void refreshAll();
    // refreshAll est redéfini à chaque rendu mais ne dépend que de userId/accountId,
    // déjà listés ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, accountId]);

  const categoriesForType = useMemo(
    () => categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense')),
    [categories, type],
  );

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [accountRes, accountsRes, categoriesRes, transactionsRes, summaryRes] = await Promise.all([
        getAccount(accountId, userId),
        listAccounts(userId),
        listCategories(userId),
        listTransactions(accountId, userId),
        getTransactionSummary(accountId, userId, startOfMonthIso(), endOfMonthIso()),
      ]);
      setAccount(accountRes);
      setOtherAccounts(accountsRes.filter((a) => a.id !== accountId));
      setCategories(categoriesRes);
      setTransactions(transactionsRes);
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
      await createTransaction({
        userId,
        accountId,
        type,
        amount,
        categoryId: type === 'transfer' ? undefined : categoryId || undefined,
        transferToAccountId: type === 'transfer' ? transferToAccountId || undefined : undefined,
        description: description || undefined,
      });
      setAmount('');
      setDescription('');
      setCategoryId('');
      setTransferToAccountId('');
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  if (!userId) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">
          Renseignez d&apos;abord votre identifiant utilisateur sur la page{' '}
          <Link href="/comptes" className="underline">
            Comptes
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <div>
        <Link href="/comptes" className="text-xs text-muted-foreground underline">
          ← Retour aux comptes
        </Link>
        <h1 className="text-2xl font-semibold">{account?.name ?? '…'}</h1>
        {account && (
          <p className="text-sm text-muted-foreground">
            {ACCOUNT_TYPE_LABELS[account.type]} · {account.ownership === 'personal' ? 'Personnel' : 'Professionnel'} ·{' '}
            {formatAmount(account.currentBalance, account.currency)}
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {summary && account && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Revenus (mois)</p>
            <p className="font-medium">{formatAmount(summary.totalIncome, account.currency)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Dépenses (mois)</p>
            <p className="font-medium">{formatAmount(summary.totalExpense, account.currency)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Net (mois)</p>
            <p className="font-medium">{formatAmount(summary.netFlow, account.currency)}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="font-medium">Ajouter une transaction</h2>

        <div className="flex items-center gap-4 text-sm">
          {TRANSACTION_TYPES.map((value) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="type"
                checked={type === value}
                onChange={() => {
                  setType(value);
                  setCategoryId('');
                  setTransferToAccountId('');
                }}
              />
              {TRANSACTION_TYPE_LABELS[value]}
            </label>
          ))}
        </div>

        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Montant"
          inputMode="decimal"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />

        {type !== 'transfer' && (
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Choisir une catégorie
            </option>
            {categoriesForType.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}

        {type === 'transfer' && (
          <select
            value={transferToAccountId}
            onChange={(event) => setTransferToAccountId(event.target.value)}
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Compte de destination
            </option>
            {otherAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        )}

        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description (optionnel)"
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
          {submitting ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Transactions {loading && '(chargement…)'}</h2>

        {!loading && transactions.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune transaction pour ce compte.</p>
        )}

        <ul className="flex flex-col gap-2">
          {transactions.map((t) => {
            const category = categories.find((c) => c.id === t.categoryId);
            const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔';
            return (
              <li key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">
                    {t.type === 'transfer' ? 'Transfert' : (category?.label ?? '—')}
                    {t.description ? ` · ${t.description}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {TRANSACTION_TYPE_LABELS[t.type]} · {new Date(t.occurredAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span
                  className={cn(
                    'font-medium',
                    t.type === 'income' && 'text-primary',
                    t.type === 'expense' && 'text-destructive',
                  )}
                >
                  {sign} {account ? formatAmount(t.amount, account.currency) : t.amount}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
