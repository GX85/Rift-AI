import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Landing, PlatformChoice, ReviewsPage } from './components/Auth';
import { CodeWorkspace } from './components/CodeWorkspace';
import { FractalBackground } from './components/FractalBackground';
import { MobileApp, MobileEntry, MobileQrPage } from './components/MobileApp';

const GUEST_KEY = 'amethyst_guest';
const PLATFORM_PICKED_KEY = 'amethyst_platform_picked';
const ENTRY_PLATFORM_KEY = 'amethyst_entry_platform';
const VIEW_KEY = 'amethyst_view';
type EntryPlatform = 'desktop' | 'phone';
type AppView = 'app' | 'home';

function readEntryPlatform(): EntryPlatform {
  return localStorage.getItem(ENTRY_PLATFORM_KEY) === 'phone' ? 'phone' : 'desktop';
}

function readAppView(): AppView {
  return localStorage.getItem(VIEW_KEY) === 'home' ? 'home' : 'app';
}

function rememberPlatform(platform: EntryPlatform) {
  localStorage.setItem(PLATFORM_PICKED_KEY, '1');
  localStorage.setItem(ENTRY_PLATFORM_KEY, platform);
}

function rememberView(view: AppView) {
  localStorage.setItem(VIEW_KEY, view);
}

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
  const [guest, setGuest] = useState(() => localStorage.getItem(GUEST_KEY) === '1');
  const [platformPicked, setPlatformPicked] = useState(() => localStorage.getItem(PLATFORM_PICKED_KEY) === '1' || localStorage.getItem(GUEST_KEY) === '1');
  const [entryPlatform, setEntryPlatform] = useState<EntryPlatform>(readEntryPlatform);
  // 'app' — чат, 'home' — главный экран (лендинг), доступен и после входа.
  const [view, setViewState] = useState<AppView>(readAppView);

  function setView(viewNext: AppView) {
    rememberView(viewNext);
    setViewState(viewNext);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        localStorage.removeItem(GUEST_KEY);
        setGuest(false);
        setPlatformPicked(true);
        if (localStorage.getItem(PLATFORM_PICKED_KEY) !== '1') rememberPlatform(readEntryPlatform());
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && (session || guest) && !platformPicked) {
      setPlatformPicked(true);
      rememberPlatform(entryPlatform);
    }
  }, [entryPlatform, guest, loading, platformPicked, session]);

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
    localStorage.setItem(GUEST_KEY, '1');
    rememberPlatform(entryPlatform);
    setGuest(true);
    setView('app');
  }

  function leaveApp() {
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem(PLATFORM_PICKED_KEY);
    localStorage.removeItem(VIEW_KEY);
    setGuest(false);
    setPlatformPicked(false);
    setViewState('app');
    supabase.auth.signOut();
  }

  function isPhoneLike() {
    return (
      window.matchMedia('(max-width: 820px), (pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    );
  }

  function choosePhone() {
    if (!isPhoneLike()) {
      window.location.href = '/qr';
      return;
    }
    setEntryPlatform('phone');
    rememberPlatform('phone');
    setPlatformPicked(true);
    setView('home');
  }

  function chooseDesktop() {
    setEntryPlatform('desktop');
    rememberPlatform('desktop');
    setPlatformPicked(true);
    setView('home');
  }

  function enterSelectedGuest() {
    if (entryPlatform === 'phone') {
      localStorage.setItem(GUEST_KEY, '1');
      rememberPlatform('phone');
      rememberView('app');
      setGuest(true);
      window.location.href = '/mobile';
      return;
    }
    enterGuest();
  }

  function openSelectedApp() {
    if (entryPlatform === 'phone') {
      window.location.href = '/mobile';
      return;
    }
    setView('app');
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

  if (!platformPicked && !session && !guest)
    return (
      <>
        {bg}
        <PlatformChoice onDesktop={chooseDesktop} onPhone={choosePhone} />
      </>
    );

  if (!session && !guest)
    return (
      <>
        {bg}
        <Landing onEnter={enterSelectedGuest} />
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
        <Landing onEnter={openSelectedApp} />
      </>
    );

  return (
    <>
      {bg}
      <CodeWorkspace
        name={p.name}
        email={p.email}
        avatar={p.avatar}
        onSignOut={leaveApp}
        onHome={() => setView('home')}
      />
    </>
  );
}
