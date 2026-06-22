import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Landing } from './components/Auth';
import { Workspace } from './components/Workspace';

const AmethystBackground = lazy(() =>
  import('./components/AmethystBackground').then((module) => ({ default: module.AmethystBackground })),
);

// Достаём из профиля Google имя и аватар (поля могут называться по-разному).
function profileOf(session: Session) {
  const m = session.user.user_metadata ?? {};
  const email = session.user.email ?? '';
  const name = (m.full_name || m.name || email.split('@')[0] || 'Гость') as string;
  const avatar = (m.avatar_url || m.picture || '') as string;
  return { email, name, avatar };
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // 'app' — чат, 'home' — главный экран (лендинг), доступен и после входа.
  const [view, setView] = useState<'app' | 'home'>('app');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // При входе сохраняем/обновляем профиль пользователя в базе данных.
  useEffect(() => {
    if (!session) return;
    const p = profileOf(session);
    supabase
      .from('profiles')
      .upsert(
        {
          id: session.user.id,
          email: p.email,
          full_name: p.name,
          avatar_url: p.avatar,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .then(() => {});
  }, [session?.user.id]);

  if (loading)
    return (
      <main className="container">
        <p className="center-loading">
          <span className="spinner" />
          Загрузка…
        </p>
      </main>
    );

  // 3D Amethyst background lives behind both the landing page and the workspace.
  const bg = (
    <>
      <Suspense fallback={null}>
        <AmethystBackground />
      </Suspense>
      <div className="bg-overlay" aria-hidden />
    </>
  );

  // До входа — полноэкранный маркетинговый лендинг.
  if (!session)
    return (
      <>
        {bg}
        <Landing />
      </>
    );

  const p = profileOf(session);

  // Главный экран после входа: тот же лендинг, но кнопки открывают чат (без повторного входа).
  if (view === 'home')
    return (
      <>
        {bg}
        <Landing onEnter={() => setView('app')} />
      </>
    );

  return (
    <>
      {bg}
      <Workspace
        name={p.name}
        email={p.email}
        avatar={p.avatar}
        onSignOut={() => supabase.auth.signOut()}
        onHome={() => setView('home')}
      />
    </>
  );
}
