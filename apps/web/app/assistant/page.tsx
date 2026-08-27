'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Send, Sparkles } from 'lucide-react';
import type { ChatTurn } from '@finza/shared-types';
import { Button, cn } from '@finza/ui';
import { askAiAdvice, getAiSummary } from '@/lib/api';
import { getStoredAccessToken } from '@/lib/auth-session';
import { AppNav } from '@/components/app-nav';
import { useToast } from '@/components/toast';

const QUICK_QUESTIONS = [
  'Analyse mes finances',
  'Comment économiser davantage ?',
  'Où part mon argent ?',
  'Analyse mes dépenses',
  "Aide-moi avec mon objectif",
  'Résume mon mois',
];

export default function AssistantPage() {
  const router = useRouter();
  const toast = useToast();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = getStoredAccessToken();
    if (!stored) {
      router.replace('/connexion');
      return;
    }
    setAccessToken(stored);
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function sendMessage(text: string) {
    if (!accessToken || !text.trim() || sending) return;
    const userTurn: ChatTurn = { role: 'user', content: text.trim() };
    const history = messages;
    setMessages((prev) => [...prev, userTurn]);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const res = await askAiAdvice(accessToken, { message: text.trim(), history });
      setMessages((prev) => [...prev, { role: 'model', content: res.reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  async function handleSummary() {
    if (!accessToken || sending) return;
    const userTurn: ChatTurn = { role: 'user', content: 'Résume ma situation financière de ce mois-ci.' };
    setMessages((prev) => [...prev, userTurn]);
    setSending(true);
    setError(null);
    try {
      const res = await getAiSummary(accessToken);
      setMessages((prev) => [...prev, { role: 'model', content: res.reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleNewConversation() {
    setMessages([]);
    setError(null);
    setInput('');
  }

  if (!accessToken) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="text-sm text-muted-foreground">Redirection vers la connexion…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-2xl flex-col gap-4 p-8">
      <AppNav />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-semibold">Assistant IA</h1>
            <p className="text-sm text-muted-foreground">
              Des conseils basés sur vos propres données — jamais une connexion à un compte externe.
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" size="sm" onClick={handleNewConversation} className="whitespace-nowrap">
            Nouvelle conversation
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border border-border p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">Posez une question sur vos finances</p>
              <p className="mt-1 text-sm text-muted-foreground">
                L&apos;assistant analyse vos revenus, dépenses, objectifs et abonnements réels — pas vos données
                bancaires, que Finza ne voit jamais.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendMessage(q)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((turn, index) => (
              <div
                key={index}
                className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    turn.role === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm bg-muted text-foreground',
                  )}
                >
                  {turn.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  L&apos;assistant réfléchit…
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          {error.includes('réservée aux abonnés Premium') && (
            <Link href="/subscription" className="whitespace-nowrap font-medium underline underline-offset-2">
              Passer à Premium
            </Link>
          )}
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending}
              onClick={() => void sendMessage(q)}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {q}
            </button>
          ))}
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleSummary()}
            className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            Résumé du mois
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="assistant-input" className="sr-only">
          Votre message à l&apos;assistant
        </label>
        <input
          id="assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Comment mieux gérer mes revenus ?"
          disabled={sending}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
        />
        <Button type="submit" disabled={sending || !input.trim()} aria-label="Envoyer" className="flex items-center justify-center">
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </main>
  );
}
