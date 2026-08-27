'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FamilyDto, SharedAccountDto } from '@finza/shared-types';
import { cn } from '@finza/ui';
import {
  addFamilyMember,
  createFamily,
  deleteFamily,
  listMyFamilies,
  listSharedAccounts,
  removeFamilyMember,
} from '@/lib/api';
import { getStoredAccessToken, getStoredUserId } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';

function formatXof(value: string) {
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

export default function FamillePage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [family, setFamily] = useState<FamilyDto | null>(null);
  const [sharedAccounts, setSharedAccounts] = useState<SharedAccountDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [familyName, setFamilyName] = useState('');
  const [memberUserId, setMemberUserId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const storedToken = getStoredAccessToken();
    if (!storedToken) {
      router.replace('/connexion');
      return;
    }
    setAccessToken(storedToken);
    setUserId(getStoredUserId() ?? '');
  }, [router]);

  useEffect(() => {
    if (!accessToken) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function refresh() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const families = await listMyFamilies(accessToken);
      const mine = families[0] ?? null;
      setFamily(mine);
      setSharedAccounts(mine ? await listSharedAccounts(mine.id, accessToken) : []);
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
      await createFamily(accessToken, { name: familyName });
      setFamilyName('');
      toast.success('Famille créée.');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddMember(event: React.FormEvent) {
    event.preventDefault();
    if (!family || !accessToken) return;
    setSubmitting(true);
    setError(null);
    try {
      await addFamilyMember(family.id, accessToken, { memberUserId });
      setMemberUserId('');
      toast.success('Membre ajouté.');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveMember(targetUserId: string, isSelf: boolean) {
    if (!family || !accessToken) return;
    const ok = await confirm({
      title: isSelf ? 'Quitter cette famille ?' : 'Retirer ce membre ?',
      danger: true,
      confirmLabel: isSelf ? 'Quitter' : 'Retirer',
    });
    if (!ok) return;
    setError(null);
    try {
      await removeFamilyMember(family.id, targetUserId, accessToken);
      toast.success(isSelf ? 'Vous avez quitté la famille.' : 'Membre retiré.');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    }
  }

  async function handleDeleteFamily() {
    if (!family || !accessToken) return;
    const ok = await confirm({
      title: `Supprimer « ${family.name} » ?`,
      description: 'Tous les membres perdront leur accès. Cette action est définitive.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteFamily(family.id, accessToken);
      toast.success('Famille supprimée.');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    }
  }

  const isOwner = family?.ownerId === userId;

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
        <h1 className="text-2xl font-semibold">Famille</h1>
        <p className="text-sm text-muted-foreground">
          Un compte n&apos;est jamais visible aux autres membres tant qu&apos;il n&apos;est pas explicitement partagé
          (page du compte).
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !family && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="font-medium">Vous n&apos;appartenez à aucune famille</h2>
          <div className="flex gap-2">
            <input
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              placeholder="Nom de la famille (ex: Famille Kaboré)"
              required
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity',
                submitting && 'opacity-60',
              )}
            >
              {submitting ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      {family && (
        <>
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{family.name}</h2>
              {isOwner && (
                <button type="button" onClick={handleDeleteFamily} className="text-xs text-destructive underline">
                  Supprimer la famille
                </button>
              )}
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {family.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between text-sm">
                  <span>
                    {m.fullName} <span className="text-xs text-muted-foreground">({m.role === 'owner' ? 'propriétaire' : 'membre'})</span>
                  </span>
                  {(isOwner && m.role !== 'owner') || m.userId === userId ? (
                    m.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.userId, m.userId === userId)}
                        className="text-xs text-destructive underline"
                      >
                        {m.userId === userId ? 'Quitter' : 'Retirer'}
                      </button>
                    )
                  ) : null}
                </li>
              ))}
            </ul>

            {isOwner && (
              <form onSubmit={handleAddMember} className="mt-4 flex gap-2 border-t border-border pt-4">
                <input
                  value={memberUserId}
                  onChange={(event) => setMemberUserId(event.target.value.trim())}
                  placeholder="Identifiant utilisateur à ajouter"
                  required
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity',
                    submitting && 'opacity-60',
                  )}
                >
                  Ajouter
                </button>
              </form>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Comptes partagés</h2>
            {sharedAccounts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucun compte partagé pour l&apos;instant. Partagez un compte depuis sa page de détail.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {sharedAccounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.ownerName}</p>
                  </div>
                  <span className="font-medium">{formatXof(a.currentBalance)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </main>
  );
}
