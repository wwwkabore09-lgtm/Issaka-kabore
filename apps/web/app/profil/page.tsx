'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { FINANCIAL_SITUATIONS, REVENUE_FREQUENCIES, type FinancialSituation, type RevenueFrequency } from '@finza/shared-types';
import { COUNTRIES } from '@finza/config';
import { Button } from '@finza/ui';
import { getMe, updateProfile } from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { useToast } from '@/components/toast';
import { FINANCIAL_SITUATION_LABELS, REVENUE_FREQUENCY_LABELS } from '@/lib/account-labels';

const COUNTRY_OPTIONS = Object.values(COUNTRIES);

export default function ProfilPage() {
  const router = useRouter();
  const toast = useToast();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [country, setCountry] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('fr');
  const [mainFinancialGoal, setMainFinancialGoal] = useState('');
  const [incomeFrequency, setIncomeFrequency] = useState<'' | RevenueFrequency>('');
  const [financialSituation, setFinancialSituation] = useState<'' | FinancialSituation>('');

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

  async function refresh() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const me = await getMe(accessToken);
      setCountry(me.country ?? '');
      setPreferredLanguage(me.preferredLanguage);
      setMainFinancialGoal(me.mainFinancialGoal ?? '');
      setIncomeFrequency(me.incomeFrequency ?? '');
      setFinancialSituation(me.financialSituation ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile(accessToken, {
        country: country || null,
        preferredLanguage,
        mainFinancialGoal: mainFinancialGoal.trim() || null,
        incomeFrequency: incomeFrequency || null,
        financialSituation: financialSituation || null,
      });
      toast.success('Profil mis à jour.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
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
      <div className="flex items-center gap-3">
        <UserRound className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Profil</h1>
          <p className="text-sm text-muted-foreground">
            Ces informations personnalisent les conseils de l&apos;Assistant IA. Rien n&apos;est requis : laissez vide
            ce que vous ne souhaitez pas renseigner.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="profile-country" className="text-xs text-muted-foreground">
              Pays
            </label>
            <select
              id="profile-country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Non renseigné</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="profile-language" className="text-xs text-muted-foreground">
              Langue préférée
            </label>
            <select
              id="profile-language"
              value={preferredLanguage}
              onChange={(event) => setPreferredLanguage(event.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="profile-goal" className="text-xs text-muted-foreground">
              Objectif financier principal
            </label>
            <input
              id="profile-goal"
              value={mainFinancialGoal}
              onChange={(event) => setMainFinancialGoal(event.target.value)}
              placeholder="Ex : Épargner pour un terrain, réduire mes dépenses…"
              maxLength={200}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="profile-frequency" className="text-xs text-muted-foreground">
              Fréquence de revenus habituelle
            </label>
            <select
              id="profile-frequency"
              value={incomeFrequency}
              onChange={(event) => setIncomeFrequency(event.target.value as '' | RevenueFrequency)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Non renseignée</option>
              {REVENUE_FREQUENCIES.map((value) => (
                <option key={value} value={value}>
                  {REVENUE_FREQUENCY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="profile-situation" className="text-xs text-muted-foreground">
              Situation financière générale
            </label>
            <select
              id="profile-situation"
              value={financialSituation}
              onChange={(event) => setFinancialSituation(event.target.value as '' | FinancialSituation)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Non renseignée</option>
              {FINANCIAL_SITUATIONS.map((value) => (
                <option key={value} value={value}>
                  {FINANCIAL_SITUATION_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" disabled={saving} className="self-start">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </form>
      )}
    </main>
  );
}
