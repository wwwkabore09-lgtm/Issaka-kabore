'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@finza/ui';
import { register } from '@/lib/api';
import { saveSession } from '@/lib/auth-session';

export default function InscriptionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await register({ email, password, fullName });
      saveSession({
        userId: result.user.id,
        email: result.user.email,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Créer un compte</h1>
        <p className="text-sm text-muted-foreground">Financial OS personnel et familial.</p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="inscription-name" className="sr-only">
          Nom complet
        </label>
        <input
          id="inscription-name"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Nom complet"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <label htmlFor="inscription-email" className="sr-only">
          Email
        </label>
        <input
          id="inscription-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <label htmlFor="inscription-password" className="sr-only">
          Mot de passe
        </label>
        <input
          id="inscription-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mot de passe (8 caractères minimum)"
          minLength={8}
          required
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{' '}
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
