'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AccountDto, GoalContributionDto, GoalProgressDto } from '@finza/shared-types';
import { cn } from '@finza/ui';
import {
  addGoalContribution,
  createGoal,
  deleteGoal,
  listAccounts,
  listGoalContributions,
  listGoals,
} from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';

function formatXof(value: string) {
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

export default function ObjectifsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [goals, setGoals] = useState<GoalProgressDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [contributionAmounts, setContributionAmounts] = useState<Record<string, string>>({});
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [contributions, setContributions] = useState<GoalContributionDto[]>([]);

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
      const [goalsRes, accountsRes] = await Promise.all([listGoals(accessToken), listAccounts(accessToken)]);
      setGoals(goalsRes);
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
      await createGoal(accessToken, {
        name,
        targetAmount,
        targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        accountId: accountId || undefined,
      });
      setName('');
      setTargetAmount('');
      setTargetDate('');
      setAccountId('');
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContribute(goalId: string) {
    if (!accessToken) return;
    const amount = contributionAmounts[goalId];
    if (!amount) return;
    setError(null);
    try {
      await addGoalContribution(goalId, accessToken, { amount });
      setContributionAmounts((prev) => ({ ...prev, [goalId]: '' }));
      await refreshAll();
      if (expandedGoalId === goalId) {
        setContributions(await listGoalContributions(goalId, accessToken));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function handleDelete(goalId: string) {
    if (!accessToken) return;
    setError(null);
    try {
      await deleteGoal(goalId, accessToken);
      if (expandedGoalId === goalId) setExpandedGoalId(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function toggleHistory(goalId: string) {
    if (!accessToken) return;
    if (expandedGoalId === goalId) {
      setExpandedGoalId(null);
      return;
    }
    setExpandedGoalId(goalId);
    try {
      setContributions(await listGoalContributions(goalId, accessToken));
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
      <div>
        <Link href="/comptes" className="text-xs text-muted-foreground underline">
          ← Comptes
        </Link>
        <h1 className="text-2xl font-semibold">Objectifs d&apos;épargne</h1>
        <p className="text-sm text-muted-foreground">
          Estimations basées sur vos contributions — jamais une garantie.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h2 className="font-medium">Nouvel objectif</h2>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nom (ex: Fonds d'urgence)"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            value={targetAmount}
            onChange={(event) => setTargetAmount(event.target.value)}
            placeholder="Montant cible"
            inputMode="decimal"
            required
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
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
          {submitting ? 'Création…' : "Créer l'objectif"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="font-medium">Vos objectifs {loading && '(chargement…)'}</h2>

        {!loading && goals.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun objectif pour le moment.</p>
        )}

        <ul className="flex flex-col gap-3">
          {goals.map((g) => (
            <li key={g.goalId} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {g.name} {g.isAchieved && <span className="text-primary">✓ Atteint</span>}
                </p>
                <button
                  type="button"
                  onClick={() => handleDelete(g.goalId)}
                  className="text-xs text-muted-foreground underline"
                >
                  Supprimer
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatXof(g.currentAmount)} / {formatXof(g.targetAmount)}
                {g.targetDate ? ` · échéance ${new Date(g.targetDate).toLocaleDateString('fr-FR')}` : ''}
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', g.isAchieved ? 'bg-primary' : 'bg-primary/70')}
                  style={{ width: `${Math.min(g.percentage, 100)}%` }}
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  value={contributionAmounts[g.goalId] ?? ''}
                  onChange={(event) =>
                    setContributionAmounts((prev) => ({ ...prev, [g.goalId]: event.target.value }))
                  }
                  placeholder="Ajouter une contribution"
                  inputMode="decimal"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleContribute(g.goalId)}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  Ajouter
                </button>
                <button
                  type="button"
                  onClick={() => toggleHistory(g.goalId)}
                  className="text-xs text-muted-foreground underline"
                >
                  {expandedGoalId === g.goalId ? 'Masquer' : 'Historique'}
                </button>
              </div>

              {expandedGoalId === g.goalId && (
                <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
                  {contributions.length === 0 && (
                    <li className="text-xs text-muted-foreground">Aucune contribution.</li>
                  )}
                  {contributions.map((c) => (
                    <li key={c.id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {new Date(c.contributedAt).toLocaleDateString('fr-FR')} {c.note ? `· ${c.note}` : ''}
                      </span>
                      <span>{formatXof(c.amount)}</span>
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
