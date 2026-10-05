import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === 'PASSWORD_RECOVERY') { setReady(true); setError(''); }
    });
    // The auth library processes the recovery link during initialization. The hash is
    // only a hint; a valid recovered session is still required for updateUser.
    if (window.location.hash.includes('type=recovery')) {
      void supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (active && data.session && !sessionError) setReady(true);
      });
    }
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError('Паролите не съвпадат.'); return; }
    setBusy(true); setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(updateError.message);
    else { setDone(true); await supabase.auth.signOut(); }
  }
  return <main className="grid min-h-screen place-items-center bg-background px-4"><div className="w-full max-w-[400px] rounded-lg border border-border bg-card p-7"><h1 className="text-xl font-semibold">Нова парола</h1>{done ? <p role="status" className="mt-4 text-sm">Паролата е променена. Можете да влезете с нея.</p> : ready ? <form onSubmit={e => void submit(e)} className="mt-5 space-y-4"><label className="block text-sm">Нова парола<Input className="mt-2" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /></label><label className="block text-sm">Повторете паролата<Input className="mt-2" type="password" autoComplete="new-password" minLength={6} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label><Button disabled={busy} className="w-full">{busy ? 'Запазва се…' : 'Запази новата парола'}</Button></form> : <p className="mt-4 text-sm text-muted-foreground">Отворете валидната връзка от писмото за възстановяване.</p>}{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}<a className="mt-5 block text-sm text-primary underline" href="/">Към вход</a></div></main>;
}

export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Нова парола — Lekar AI v2' }, { name: 'description', content: 'Възстановяване на достъпа до Lekar AI v2.' }, { property: 'og:title', content: 'Нова парола — Lekar AI v2' }, { property: 'og:description', content: 'Възстановяване на достъпа до Lekar AI v2.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: ResetPassword,
});
