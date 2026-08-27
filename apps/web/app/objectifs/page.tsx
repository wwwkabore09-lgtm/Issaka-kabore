'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target } from 'lucide-react';
import type { AccountDto, GoalContributionDto, GoalProgressDto } from '@finza/shared-types';
import { Badge, Button, EmptyState, cn, type BadgeTone } from '@finza/ui';
import {
  addGoalContribution,
  createGoal,
  deleteGoal,
  listAccounts,
  listGoalContributions,
  listGoals,
  updateGoal,
} from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';

function formatXof(value: string) {
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

function goalStatus(g: GoalProgressDto): { label: string; tone: BadgeTone } {
  if (g.isAchieved) return { label: '✓ Atteint', tone: 'success' };
  if (g.percentage >= 80) return { label: 'Presque atteint', tone: 'warning' };
  return { label: 'En cours', tone: 'muted' };
}

export default function ObjectifsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTargetAmount, setEditTargetAmount] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
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
      toast.success('Objectif créé.');
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(g: GoalProgressDto) {
    setEditingId(g.goalId);
    setEditName(g.name);
    setEditTargetAmount(g.targetAmount);
    setEditTargetDate(g.targetDate ? g.targetDate.slice(0, 10) : '');
  }

  async function handleSaveEdit(goalId: string) {
    if (!accessToken) return;
    setSavingEdit(true);
    setError(null);
    try {
      await updateGoal(goalId, accessToken, {
        name: editName,
        targetAmount: editTargetAmount,
        targetDate: editTargetDate ? new Date(editTargetDate).toISOString() : null,
      });
      setEditingId(null);
      toast.success('Objectif modifié.');
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSavingEdit(false);
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
      toast.success('Contribution ajoutée.');
      await refreshAll();
      if (expandedGoalId === goalId) {
        setContributions(await listGoalContributions(goalId, accessToken));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    }
  }

  async function handleDelete(goal: GoalProgressDto) {
    if (!accessToken) return;
    const ok = await confirm({
      title: `Supprimer « ${goal.name} » ?`,
      description: 'Toutes les contributions associées seront définitivement supprimées.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteGoal(goal.goalId, accessToken);
      if (expandedGoalId === goal.goalId) setExpandedGoalId(null);
      toast.success('Objectif supprimé.');
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
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
      <AppNav />
      <div>
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

        <label htmlFor="goal-name" className="sr-only">
          Nom
        </label>
        <input
          id="goal-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nom (ex: Fonds d'urgence)"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-target-amount" className="text-xs text-muted-foreground">
              Montant cible
            </label>
            <input
              id="goal-target-amount"
              value={targetAmount}
              onChange={(event) => setTargetAmount(event.target.value)}
              inputMode="decimal"
              required
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-target-date" className="text-xs text-muted-foreground">
              Date cible (optionnel)
            </label>
            <input
              id="goal-target-date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <label htmlFor="goal-account" className="sr-only">
          Compte lié
        </label>
        <select
          id="goal-account"
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

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Création…' : "Créer l'objectif"}
        </Button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="font-medium">Vos objectifs {loading && '(chargement…)'}</h2>

        {!loading && goals.length === 0 && (
          <EmptyState
            icon={Target}
            title="Aucun objectif enregistré"
            description="Créez votre premier objectif d'épargne pour commencer à suivre votre progression."
          />
        )}

        <ul className="flex flex-col gap-3">
          {goals.map((g) => {
            const status = goalStatus(g);
            const isEditing = editingId === g.goalId;
            return (
              <li key={g.goalId} className="rounded-lg border border-border p-4">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <label htmlFor={`edit-goal-name-${g.goalId}`} className="text-xs text-muted-foreground">
                      Nom
                    </label>
                    <input
                      id={`edit-goal-name-${g.goalId}`}
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`edit-goal-amount-${g.goalId}`} className="text-xs text-muted-foreground">
                          Montant cible
                        </label>
                        <input
                          id={`edit-goal-amount-${g.goalId}`}
                          value={editTargetAmount}
                          onChange={(event) => setEditTargetAmount(event.target.value)}
                          inputMode="decimal"
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`edit-goal-date-${g.goalId}`} className="text-xs text-muted-foreground">
                          Date cible
                        </label>
                        <input
                          id={`edit-goal-date-${g.goalId}`}
                          type="date"
                          value={editTargetDate}
                          onChange={(event) => setEditTargetDate(event.target.value)}
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={savingEdit} onClick={() => handleSaveEdit(g.goalId)}>
                        {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-2 font-medium">
                        {g.name}
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </p>
                      <div className="flex items-center gap-3">
                        <Button variant="link" size="sm" onClick={() => startEdit(g)}>
                          Modifier
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(g)}>
                          Supprimer
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatXof(g.currentAmount)} / {formatXof(g.targetAmount)} · {g.percentage.toLocaleString('fr-FR')} % ·{' '}
                      {formatXof(g.remaining)} restant
                      {g.targetDate ? ` · échéance ${new Date(g.targetDate).toLocaleDateString('fr-FR')}` : ''}
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', g.isAchieved ? 'bg-primary' : 'bg-primary/70')}
                        style={{ width: `${Math.min(g.percentage, 100)}%` }}
                      />
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <label htmlFor={`contribution-${g.goalId}`} className="sr-only">
                        Ajouter une contribution
                      </label>
                      <input
                        id={`contribution-${g.goalId}`}
                        value={contributionAmounts[g.goalId] ?? ''}
                        onChange={(event) =>
                          setContributionAmounts((prev) => ({ ...prev, [g.goalId]: event.target.value }))
                        }
                        placeholder="Ajouter une contribution"
                        inputMode="decimal"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      />
                      <Button size="sm" onClick={() => handleContribute(g.goalId)}>
                        Ajouter
                      </Button>
                      <Button variant="link" size="sm" onClick={() => toggleHistory(g.goalId)}>
                        {expandedGoalId === g.goalId ? 'Masquer' : 'Historique'}
                      </Button>
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
