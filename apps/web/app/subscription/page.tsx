'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Crown, Loader2, Sparkles } from 'lucide-react';
import type { PaymentDto, PremiumSubscriptionDto } from '@finza/shared-types';
import { cn } from '@finza/ui';
import { getPremiumStatus, listPremiumPayments, subscribeToPremium, updateAutoRenew } from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { useToast } from '@/components/toast';
import { useConfirm } from '@/components/confirm-dialog';

const PREMIUM_BENEFITS = [
  "Assistant IA personnalisé qui analyse vos revenus, dépenses et objectifs réels",
  'Résumé mensuel automatique de votre situation financière',
  'Conseils adaptés à votre pays et votre devise, jamais génériques',
  'Réponses instantanées à vos questions sur votre budget',
];

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  processing: 'En cours de vérification',
  successful: 'Payé',
  failed: 'Échoué',
  cancelled: 'Annulé',
  refunded: 'Remboursé',
};

function formatXof(value: string) {
  return `${Number(value).toLocaleString('fr-FR')} FCFA`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SubscriptionPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PremiumSubscriptionDto | null>(null);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasActiveRef = useRef<boolean | null>(null);

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
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Tant qu'un paiement est en cours de vérification, on réinterroge périodiquement le
  // serveur (source de vérité) — jamais une activation supposée côté client.
  useEffect(() => {
    if (!accessToken || subscription?.status !== 'pending') return;
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, subscription?.status]);

  async function refresh() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const [sub, history] = await Promise.all([getPremiumStatus(accessToken), listPremiumPayments(accessToken)]);
      if (wasActiveRef.current === false && sub.isPremium) {
        toast.success('Paiement confirmé. Votre abonnement Premium est maintenant actif.');
      }
      wasActiveRef.current = sub.isPremium;
      setSubscription(sub);
      setPayments(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubscribe() {
    if (!accessToken) return;
    setSubscribing(true);
    setError(null);
    try {
      const res = await subscribeToPremium(accessToken);
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      toast.success('Demande de paiement créée. En attente de confirmation.');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSubscribing(false);
    }
  }

  async function handleToggleAutoRenew(next: boolean) {
    if (!accessToken) return;
    if (!next) {
      const ok = await confirm({
        title: 'Annuler le renouvellement automatique ?',
        description: 'Vous garderez Premium jusqu\'à votre date de fin actuelle, mais il ne sera pas renouvelé automatiquement ensuite.',
        confirmLabel: 'Annuler le renouvellement',
        danger: true,
      });
      if (!ok) return;
    }
    setTogglingAutoRenew(true);
    setError(null);
    try {
      const sub = await updateAutoRenew(accessToken, { autoRenew: next });
      setSubscription(sub);
      toast.success(next ? 'Renouvellement automatique réactivé.' : 'Renouvellement automatique annulé.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setTogglingAutoRenew(false);
    }
  }

  if (!accessToken) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
      </main>
    );
  }

  const isPremium = subscription?.isPremium ?? false;
  const status = subscription?.status ?? 'none';

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <AppNav />
      <div>
        <h1 className="text-2xl font-semibold">Abonnement</h1>
        <p className="text-sm text-muted-foreground">Un seul plan, un prix simple.</p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && !subscription ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          {status === 'pending' && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Votre paiement est en cours de vérification.
            </p>
          )}
          {status === 'expired' && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Votre abonnement Premium a expiré. Renouvelez-le pour retrouver les fonctionnalités Premium.
            </p>
          )}
          {status === 'cancelled' && (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Votre abonnement Premium n&apos;est plus actif (renouvellement précédemment annulé).
            </p>
          )}

          <div className="rounded-lg border border-border bg-gradient-to-br from-primary/5 to-transparent p-6">
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 text-primary" aria-hidden="true" />
              <h2 className="text-xl font-semibold">Premium</h2>
            </div>
            <p className="mt-1 text-3xl font-bold">
              2 000 FCFA <span className="text-base font-normal text-muted-foreground">/ mois</span>
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {PREMIUM_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              {isPremium ? (
                <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Abonnement actif
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className={cn(
                    'flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90',
                    subscribing && 'opacity-60',
                  )}
                >
                  {subscribing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {subscribing ? 'Paiement en cours…' : status === 'expired' || status === 'cancelled' ? 'Renouveler Premium' : 'Passer à Premium'}
                </button>
              )}
            </div>
          </div>

          {subscription && subscription.status !== 'none' && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="font-medium">Votre abonnement</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Statut</dt>
                  <dd className="font-medium capitalize">{status === 'active' ? 'Actif' : status === 'pending' ? 'En attente' : status === 'expired' ? 'Expiré' : 'Annulé'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Date de début</dt>
                  <dd className="font-medium">{subscription.startDate ? formatDate(subscription.startDate) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Prochaine expiration</dt>
                  <dd className="font-medium">{subscription.endDate ? formatDate(subscription.endDate) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Renouvellement automatique</dt>
                  <dd className="font-medium">{subscription.autoRenew ? 'Activé' : 'Désactivé'}</dd>
                </div>
              </dl>
              {isPremium && (
                <button
                  type="button"
                  disabled={togglingAutoRenew}
                  onClick={() => void handleToggleAutoRenew(!subscription.autoRenew)}
                  className={cn(
                    'mt-4 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground',
                    togglingAutoRenew && 'opacity-60',
                  )}
                >
                  {subscription.autoRenew ? 'Annuler le renouvellement' : 'Réactiver le renouvellement'}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="font-medium">Historique des paiements</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paiement pour le moment.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="font-medium">Premium</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.createdAt)}
                        {p.provider !== 'unconfigured' ? ` · ${p.provider}` : ''}
                        {p.providerTransactionId ? ` · réf. ${p.providerTransactionId}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-medium">{formatXof(p.amount)}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          p.status === 'successful' && 'bg-primary/10 text-primary',
                          (p.status === 'failed' || p.status === 'cancelled') && 'bg-destructive/10 text-destructive',
                          (p.status === 'pending' || p.status === 'processing') && 'bg-muted text-muted-foreground',
                          p.status === 'refunded' && 'bg-muted text-muted-foreground',
                        )}
                      >
                        {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}
