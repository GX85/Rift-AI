import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Landing, PlatformChoice, ReviewsPage } from './components/Auth';
import { Workspace } from './components/Workspace';
import { FractalBackground } from './components/FractalBackground';
import { MobileApp, MobileEntry, MobileQrPage } from './components/MobileApp';

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
  const [guest, setGuest] = useState(() => localStorage.getItem('amethyst_guest') === '1');
  const [platformPicked, setPlatformPicked] = useState(false);
  // 'app' — чат, 'home' — главный экран (лендинг), доступен и после входа.
  const [view, setView] = useState<'app' | 'home'>('app');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        localStorage.removeItem('amethyst_guest');
        setGuest(false);
      }
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

  // Cubic WebGL fractal lives behind both the landing page and the workspace.
  const bg = (
    <>
      <FractalBackground />
      <div className="bg-overlay" aria-hidden />
    </>
  );

  // До входа — полноэкранный маркетинговый лендинг.
  function enterGuest() {
    localStorage.setItem('amethyst_guest', '1');
    setGuest(true);
    setView('app');
  }

  function leaveApp() {
    localStorage.removeItem('amethyst_guest');
    setGuest(false);
    supabase.auth.signOut();
  }

  function isPhoneLike() {
    return (
      window.matchMedia('(max-width: 820px), (pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    );
  }

  function choosePhone() {
    window.location.href = isPhoneLike() ? '/mobile' : '/qr';
  }

  if (window.location.pathname === '/reviews')
    return (
      <>
        {bg}
        <ReviewsPage />
      </>
    );

  if (window.location.pathname === '/qr')
    return (
      <>
        {bg}
        <MobileQrPage />
      </>
    );

  if (window.location.pathname === '/mobile') {
    if (!session && !guest)
      return (
        <>
          {bg}
          <MobileEntry onEnter={enterGuest} />
        </>
      );

    const mobileProfile = session
      ? profileOf(session)
      : { email: 'guest@amethyst.local', name: 'Гость', avatar: '' };

    return (
      <>
        {bg}
        <MobileApp
          name={mobileProfile.name}
          email={mobileProfile.email}
          avatar={mobileProfile.avatar}
          onSignOut={leaveApp}
          onHome={() => {
            window.location.href = '/';
          }}
        />
      </>
    );
  }

  if (!session && !guest && !platformPicked)
    return (
      <>
        {bg}
        <PlatformChoice onDesktop={() => setPlatformPicked(true)} onPhone={choosePhone} />
      </>
    );

  if (!session && !guest)
    return (
      <>
        {bg}
        <Landing onEnter={enterGuest} />
      </>
    );

  const p = session
    ? profileOf(session)
    : { email: 'guest@amethyst.local', name: 'Гость', avatar: '' };

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
        onSignOut={leaveApp}
        onHome={() => setView('home')}
      />
    </>
  );
}
