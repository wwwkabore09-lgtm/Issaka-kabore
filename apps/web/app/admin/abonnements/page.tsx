'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import type { AdminPaymentDto, AdminPremiumStatsDto } from '@finza/shared-types';
import { Badge, EmptyState } from '@finza/ui';
import { getAdminPremiumStats, getMe, listAdminPremiumTransactions } from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  processing: 'En cours',
  successful: 'Payé',
  failed: 'Échoué',
  cancelled: 'Annulé',
  refunded: 'Remboursé',
};

function formatXof(value: string) {
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminAbonnementsPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminPremiumStatsDto | null>(null);
  const [transactions, setTransactions] = useState<AdminPaymentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    void checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function checkAccessAndLoad() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const me = await getMe(accessToken);
      if (!me.isAdmin) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);
      const [statsRes, txRes] = await Promise.all([
        getAdminPremiumStats(accessToken),
        listAdminPremiumTransactions(accessToken),
      ]);
      setStats(statsRes);
      setTransactions(txRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  if (!accessToken) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
      </main>
    );
  }

  if (authorized === false) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
        <AppNav />
        <EmptyState icon={ShieldAlert} title="Accès réservé aux administrateurs" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <AppNav />
      <div>
        <h1 className="text-2xl font-semibold">Administration — Abonnements</h1>
        <p className="text-sm text-muted-foreground">Vue d&apos;ensemble des abonnements Premium et des paiements.</p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && !stats ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        stats && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Utilisateurs Premium</p>
                <p className="mt-1 text-lg font-semibold">{stats.premiumUsersCount}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Abonnements expirés</p>
                <p className="mt-1 text-lg font-semibold">{stats.expiredSubscriptionsCount}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Abonnements annulés</p>
                <p className="mt-1 text-lg font-semibold">{stats.cancelledSubscriptionsCount}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Paiements en attente</p>
                <p className="mt-1 text-lg font-semibold">{stats.pendingPaymentsCount}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Paiements réussis</p>
                <p className="mt-1 text-lg font-semibold text-primary">{stats.successfulPaymentsCount}</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Paiements échoués</p>
                <p className="mt-1 text-lg font-semibold text-destructive">{stats.failedPaymentsCount}</p>
              </div>
              <div className="col-span-2 rounded-lg border border-border p-3 text-center sm:col-span-2">
                <p className="text-xs text-muted-foreground">Revenus totaux</p>
                <p className="mt-1 text-lg font-semibold">{formatXof(stats.totalRevenue)}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="font-medium">Historique des transactions</h2>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune transaction pour le moment.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Utilisateur</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Montant</th>
                        <th className="px-3 py-2 font-medium">Statut</th>
                        <th className="px-3 py-2 font-medium">Référence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">
                            <div className="font-medium">{tx.userFullName}</div>
                            <div className="text-xs text-muted-foreground">{tx.userEmail}</div>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDate(tx.createdAt)}</td>
                          <td className="px-3 py-2 font-medium">{formatXof(tx.amount)}</td>
                          <td className="px-3 py-2">
                            <Badge tone={tx.status === 'successful' ? 'success' : tx.status === 'failed' || tx.status === 'cancelled' ? 'danger' : 'muted'}>
                              {PAYMENT_STATUS_LABELS[tx.status] ?? tx.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{tx.providerTransactionId ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      )}
    </main>
  );
}
