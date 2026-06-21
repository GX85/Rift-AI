import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Agents } from './components/Agents';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading)
    return (
      <main className="container">
        <p className="center-loading">
          <span className="spinner" />
          Загрузка…
        </p>
      </main>
    );

  return (
    <main className="container">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">🤖</div>
          <div className="brand-name">
            Rift <span>AI</span>
          </div>
        </div>
        {session && (
          <button className="ghost" onClick={() => supabase.auth.signOut()}>
            Выйти
          </button>
        )}
      </header>

      {!session ? <Auth /> : <Agents userEmail={session.user.email ?? ''} />}
    </main>
  );
}
