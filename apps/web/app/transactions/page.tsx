'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';
import type { AccountDto, CategoryDto, TransactionDto, TransactionType } from '@finza/shared-types';
import { TRANSACTION_TYPES } from '@finza/shared-types';
import { CURRENCIES } from '@finza/config';
import { Badge, Button, EmptyState, cn, type BadgeTone } from '@finza/ui';
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listAllTransactions,
  listCategories,
  updateTransaction,
  type TransactionFilters,
} from '@/lib/api';
import { getStoredAccessToken, getStoredUserId } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';
import { endOfDayIso, periodRange, startOfDayIso, type PeriodOption } from '@/lib/date-range';

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Revenu',
  expense: 'Dépense',
  transfer: 'Transfert',
};

const TRANSACTION_TYPE_TONES: Record<TransactionType, BadgeTone> = {
  income: 'success',
  expense: 'danger',
  transfer: 'muted',
};

type PeriodFilter = 'all' | PeriodOption;
type SortOrder = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

function formatAmount(value: string, currency: string) {
  const symbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? currency;
  return `${Number(value).toLocaleString('fr-FR')} ${symbol}`;
}

export default function TransactionsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<'' | TransactionType>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date_desc');

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formAccountId, setFormAccountId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formTransferToAccountId, setFormTransferToAccountId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formOccurredAt, setFormOccurredAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const stored = getStoredAccessToken();
    if (!stored) {
      router.replace('/connexion');
      return;
    }
    setAccessToken(stored);
    setUserId(getStoredUserId() ?? '');
  }, [router]);

  useEffect(() => {
    if (!accessToken || !userId) return;
    void loadStaticData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, userId]);

  async function loadStaticData() {
    if (!accessToken) return;
    try {
      const [accountsRes, categoriesRes] = await Promise.all([listAccounts(accessToken), listCategories(accessToken)]);
      setAccounts(accountsRes);
      setCategories(categoriesRes);
      if (accountsRes.length > 0) setFormAccountId(accountsRes[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!accessToken) return;
    void refreshTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, typeFilter, categoryFilter, periodFilter, customFrom, customTo, debouncedSearch]);

  async function refreshTransactions() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const range =
        periodFilter === 'custom'
          ? { from: customFrom ? startOfDayIso(customFrom) : undefined, to: customTo ? endOfDayIso(customTo) : undefined }
          : periodFilter === 'all'
            ? {}
            : periodRange(periodFilter);
      const filters: TransactionFilters = {
        type: typeFilter || undefined,
        categoryId: categoryFilter || undefined,
        from: range.from,
        to: range.to,
        q: debouncedSearch || undefined,
      };
      setTransactions(await listAllTransactions(accessToken, filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const formCategoriesForType = useMemo(
    () => categories.filter((c) => c.kind === (formType === 'income' ? 'income' : 'expense')),
    [categories, formType],
  );

  const sortedTransactions = useMemo(() => {
    const copy = [...transactions];
    copy.sort((a, b) => {
      if (sortOrder === 'date_desc') return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (sortOrder === 'date_asc') return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
      if (sortOrder === 'amount_desc') return Number(b.amount) - Number(a.amount);
      return Number(a.amount) - Number(b.amount);
    });
    return copy;
  }, [transactions, sortOrder]);

  function resetForm() {
    setFormType('expense');
    setFormAmount('');
    setFormCategoryId('');
    setFormTransferToAccountId('');
    setFormDescription('');
    setFormOccurredAt('');
    setShowForm(false);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !formAccountId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createTransaction(accessToken, {
        accountId: formAccountId,
        type: formType,
        amount: formAmount,
        categoryId: formType !== 'transfer' ? formCategoryId || undefined : undefined,
        transferToAccountId: formType === 'transfer' ? formTransferToAccountId || undefined : undefined,
        description: formDescription || undefined,
        occurredAt: formOccurredAt ? new Date(formOccurredAt).toISOString() : undefined,
      });
      resetForm();
      toast.success(formType === 'income' ? 'Revenu ajouté.' : formType === 'expense' ? 'Dépense ajoutée.' : 'Transfert ajouté.');
      await refreshTransactions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(t: TransactionDto) {
    setEditingId(t.id);
    setEditAmount(t.amount);
    setEditCategoryId(t.categoryId ?? '');
    setEditDescription(t.description ?? '');
  }

  async function handleSaveEdit(t: TransactionDto) {
    if (!accessToken) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateTransaction(t.id, accessToken, {
        amount: editAmount !== t.amount ? editAmount : undefined,
        categoryId: t.type !== 'transfer' && editCategoryId !== t.categoryId ? editCategoryId : undefined,
        description: editDescription !== (t.description ?? '') ? editDescription : undefined,
      });
      setEditingId(null);
      toast.success('Transaction modifiée.');
      await refreshTransactions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(t: TransactionDto) {
    if (!accessToken) return;
    const ok = await confirm({
      title: 'Supprimer cette transaction ?',
      description: 'Le solde du compte sera ajusté en conséquence. Cette action est définitive.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteTransaction(t.id, accessToken);
      toast.success('Transaction supprimée.');
      await refreshTransactions();
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
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-8">
      <AppNav />
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">Tous vos revenus et dépenses, tous comptes confondus.</p>
        </div>
        {!showForm && accounts.length > 0 && (
          <Button onClick={() => setShowForm(true)} className="whitespace-nowrap">
            + Ajouter
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {accounts.length === 0 && (
        <EmptyState
          title="Aucun compte pour le moment"
          description="Créez d'abord une source de revenus dans « Comptes » pour pouvoir enregistrer des transactions."
        />
      )}

      {showForm && accounts.length > 0 && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-medium">Nouvelle transaction</h2>

          <div className="flex items-center gap-4 text-sm">
            {TRANSACTION_TYPES.map((value) => (
              <label key={value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="new-tx-type"
                  checked={formType === value}
                  onChange={() => {
                    setFormType(value);
                    setFormCategoryId('');
                    setFormTransferToAccountId('');
                  }}
                />
                {TRANSACTION_TYPE_LABELS[value]}
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="new-tx-account" className="text-xs text-muted-foreground">
                Compte
              </label>
              <select
                id="new-tx-account"
                value={formAccountId}
                onChange={(event) => setFormAccountId(event.target.value)}
                required
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="new-tx-amount" className="text-xs text-muted-foreground">
                Montant
              </label>
              <input
                id="new-tx-amount"
                value={formAmount}
                onChange={(event) => setFormAmount(event.target.value)}
                inputMode="decimal"
                required
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {formType !== 'transfer' ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="new-tx-category" className="text-xs text-muted-foreground">
                Catégorie
              </label>
              <select
                id="new-tx-category"
                value={formCategoryId}
                onChange={(event) => setFormCategoryId(event.target.value)}
                required
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Choisir une catégorie
                </option>
                {formCategoriesForType.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="new-tx-destination" className="text-xs text-muted-foreground">
                Compte de destination
              </label>
              <select
                id="new-tx-destination"
                value={formTransferToAccountId}
                onChange={(event) => setFormTransferToAccountId(event.target.value)}
                required
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Choisir un compte
                </option>
                {accounts.filter((a) => a.id !== formAccountId).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="new-tx-date" className="text-xs text-muted-foreground">
                Date (optionnel, aujourd&apos;hui par défaut)
              </label>
              <input
                id="new-tx-date"
                type="date"
                value={formOccurredAt}
                onChange={(event) => setFormOccurredAt(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="new-tx-description" className="text-xs text-muted-foreground">
                Description (optionnel)
              </label>
              <input
                id="new-tx-description"
                value={formDescription}
                onChange={(event) => setFormDescription(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Ajout…' : 'Ajouter'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      {accounts.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-search" className="text-xs text-muted-foreground">
              Rechercher
            </label>
            <input
              id="filter-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Description…"
              className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-type" className="text-xs text-muted-foreground">
              Type
            </label>
            <select
              id="filter-type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as '' | TransactionType)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Tout</option>
              {TRANSACTION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {TRANSACTION_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-category" className="text-xs text-muted-foreground">
              Catégorie
            </label>
            <select
              id="filter-category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-period" className="text-xs text-muted-foreground">
              Période
            </label>
            <select
              id="filter-period"
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Toutes</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
              <option value="custom">Personnalisée</option>
            </select>
          </div>
          {periodFilter === 'custom' && (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-from" className="text-xs text-muted-foreground">
                  Du
                </label>
                <input
                  id="filter-from"
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-to" className="text-xs text-muted-foreground">
                  Au
                </label>
                <input
                  id="filter-to"
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-sort" className="text-xs text-muted-foreground">
              Trier
            </label>
            <select
              id="filter-sort"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="date_desc">Plus récent d&apos;abord</option>
              <option value="date_asc">Plus ancien d&apos;abord</option>
              <option value="amount_desc">Montant décroissant</option>
              <option value="amount_asc">Montant croissant</option>
            </select>
          </div>
        </div>
      )}

      {accounts.length > 0 && !loading && sortedTransactions.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="Aucune transaction enregistrée"
          description="Ajoutez votre premier revenu ou votre première dépense pour commencer à suivre vos finances."
          action={
            !showForm && <Button onClick={() => setShowForm(true)}>Ajouter une transaction</Button>
          }
        />
      )}

      <ul className="flex flex-col gap-2">
        {sortedTransactions.map((t) => {
          const account = accountById.get(t.accountId);
          const destination = t.transferToAccountId ? accountById.get(t.transferToAccountId) : undefined;
          const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
          const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔';
          const isEditing = editingId === t.id;

          return (
            <li key={t.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={TRANSACTION_TYPE_TONES[t.type]}>{TRANSACTION_TYPE_LABELS[t.type]}</Badge>
                    <p className="truncate font-medium">
                      {t.type === 'transfer' ? `${account?.name ?? '—'} → ${destination?.name ?? '—'}` : (category?.label ?? '—')}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {account?.name ?? '—'} · {new Date(t.occurredAt).toLocaleDateString('fr-FR')}
                    {t.description ? ` · ${t.description}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={cn(
                      'font-medium',
                      t.type === 'income' && 'text-primary',
                      t.type === 'expense' && 'text-destructive',
                    )}
                  >
                    {sign} {account ? formatAmount(t.amount, account.currency) : t.amount}
                  </span>
                  {!isEditing && (
                    <>
                      <Button variant="link" size="sm" onClick={() => startEdit(t)}>
                        Modifier
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(t)}>
                        Supprimer
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="flex flex-wrap items-end gap-2 border-t border-border pt-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor={`edit-amount-${t.id}`} className="text-xs text-muted-foreground">
                      Montant
                    </label>
                    <input
                      id={`edit-amount-${t.id}`}
                      value={editAmount}
                      onChange={(event) => setEditAmount(event.target.value)}
                      inputMode="decimal"
                      disabled={t.type === 'transfer'}
                      className="w-32 rounded-md border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
                    />
                  </div>
                  {t.type !== 'transfer' && (
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`edit-category-${t.id}`} className="text-xs text-muted-foreground">
                        Catégorie
                      </label>
                      <select
                        id={`edit-category-${t.id}`}
                        value={editCategoryId}
                        onChange={(event) => setEditCategoryId(event.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      >
                        {categories.filter((c) => c.kind === t.type).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <label htmlFor={`edit-description-${t.id}`} className="text-xs text-muted-foreground">
                      Description
                    </label>
                    <input
                      id={`edit-description-${t.id}`}
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                  </div>
                  <Button size="sm" disabled={savingEdit} onClick={() => handleSaveEdit(t)}>
                    {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                    Annuler
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
