'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ACCOUNT_OWNERSHIPS, ACCOUNT_TYPES, type AccountDto, type AccountOwnership, type AccountType } from '@finza/shared-types';
import { COUNTRIES, CURRENCIES, LAUNCH_COUNTRY, type CurrencyCode } from '@finza/config';
import { cn } from '@finza/ui';
import { createAccount, listAccounts, logout as apiLogout, updateAccount } from '@/lib/api';
import { ACCOUNT_TYPE_LABELS } from '@/lib/account-labels';
import { clearSession, getStoredRefreshToken, getStoredUserEmail } from '@/lib/auth-session';

const USER_ID_STORAGE_KEY = 'finza_demo_user_id';
const DEFAULT_CURRENCY = COUNTRIES[LAUNCH_COUNTRY].currency;

function formatBalance(value: string, currency: string) {
  const symbol = CURRENCIES[currency as keyof typeof CURRENCIES]?.symbol ?? currency;
  return `${Number(value).toLocaleString('fr-FR')} ${symbol}`;
}

export default function ComptesPage() {
  const [userId, setUserId] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('orange_money');
  const [ownership, setOwnership] = useState<AccountOwnership>('personal');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [openingBalance, setOpeningBalance] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (stored) setUserId(stored);
    setSessionEmail(getStoredUserEmail());
  }, []);

  async function handleLogout() {
    const refreshToken = getStoredRefreshToken();
    try {
      if (refreshToken) await apiLogout(refreshToken);
    } catch {
      // Le token est peut-être déjà expiré/révoqué côté serveur — on nettoie quand même localement.
    }
    clearSession();
    setSessionEmail(null);
  }

  useEffect(() => {
    if (!userId) {
      setAccounts([]);
      return;
    }

    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    void refreshAccounts(userId);
  }, [userId]);

  async function refreshAccounts(forUserId: string) {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await listAccounts(forUserId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) {
      setError('Renseignez un identifiant utilisateur (voir apps/api : npm run prisma:seed).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createAccount({
        userId,
        name,
        type,
        ownership,
        currency,
        openingBalance: openingBalance || undefined,
      });
      setName('');
      setOpeningBalance('');
      await refreshAccounts(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(account: AccountDto) {
    setError(null);
    try {
      await updateAccount(account.id, userId, { isActive: !account.isActive });
      await refreshAccounts(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Comptes</h1>
          <div className="flex gap-3">
            <Link href="/objectifs" className="text-xs text-muted-foreground underline">
              Objectifs d&apos;épargne →
            </Link>
            <Link href="/dettes" className="text-xs text-muted-foreground underline">
              Dettes et créances →
            </Link>
            <Link href="/abonnements" className="text-xs text-muted-foreground underline">
              Abonnements →
            </Link>
            <Link href="/rapports" className="text-xs text-muted-foreground underline">
              Rapports →
            </Link>
            <Link href="/famille" className="text-xs text-muted-foreground underline">
              Famille →
            </Link>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Mobile Money, comptes bancaires et espèces, personnels ou professionnels.
        </p>
      </div>

      {sessionEmail ? (
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
          <span>
            Connecté : <span className="font-medium">{sessionEmail}</span>
          </span>
          <button type="button" onClick={handleLogout} className="text-xs text-muted-foreground underline">
            Se déconnecter
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/connexion" className="underline">
            Se connecter
          </Link>{' '}
          pour remplir automatiquement votre identifiant, ou saisissez-le manuellement ci-dessous.
        </p>
      )}

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
        <p className="text-xs text-muted-foreground">
          Provisoire : les autres pages ne vérifient pas encore le token, elles font confiance à cet identifiant — se
          connecter le remplit automatiquement.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="font-medium">Ajouter un compte</h2>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nom (ex: Orange Money principal)"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as AccountType)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ACCOUNT_TYPES.map((value) => (
              <option key={value} value={value}>
                {ACCOUNT_TYPE_LABELS[value]}
              </option>
            ))}
          </select>

          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.values(CURRENCIES).map((c) => (
              <option key={c.code} value={c.code}>
                {c.label} ({c.code})
              </option>
            ))}
          </select>
        </div>

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

        <input
          value={openingBalance}
          onChange={(event) => setOpeningBalance(event.target.value)}
          placeholder="Solde d'ouverture (optionnel, défaut 0)"
          inputMode="decimal"
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
          {submitting ? 'Création…' : 'Créer le compte'}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Vos comptes {loading && '(chargement…)'}</h2>

        {!userId && <p className="text-sm text-muted-foreground">Renseignez un identifiant utilisateur ci-dessus.</p>}
        {userId && !loading && accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun compte pour cet utilisateur.</p>
        )}

        <ul className="flex flex-col gap-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className={cn(
                'flex items-center justify-between rounded-lg border border-border p-3',
                !account.isActive && 'opacity-50',
              )}
            >
              <Link href={`/comptes/${account.id}`} className="hover:underline">
                <p className="font-medium">{account.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ACCOUNT_TYPE_LABELS[account.type]} · {account.ownership === 'personal' ? 'Personnel' : 'Professionnel'}
                </p>
              </Link>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatBalance(account.currentBalance, account.currency)}</span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(account)}
                  className="text-xs text-muted-foreground underline"
                >
                  {account.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
