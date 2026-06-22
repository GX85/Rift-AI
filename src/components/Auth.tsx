import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AmethystLogo } from './Gems';
import { Icon } from './Icons';

// Возможности (бесплатно) и привилегии Plus — для главного экрана.
const PLUS_PERKS = [
  { icon: 'star', title: 'Без лимитов', text: 'Сколько угодно сообщений — у бесплатного есть лимит.' },
  { icon: 'globe', title: 'Создание сайтов', text: 'Опиши сайт — Amethyst сгенерирует и даст скачать готовый HTML.' },
  { icon: 'game', title: 'Игровая студия', text: 'Играбельные 2D-игры одним запросом, прямо в окне.' },
  { icon: 'memory', title: 'Память 20 ГБ', text: 'Amethyst помнит факты о тебе во всех чатах.' },
  { icon: 'volume', title: 'Озвучка и темы', text: 'Голосовое чтение ответов и выбор цвета интерфейса.' },
  { icon: 'attach', title: 'Файлы и длинные ответы', text: 'Прикрепляй файлы и получай развёрнутые ответы.' },
];

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72A5.4 5.4 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.06l3.02-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94L3.98 7.28C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function Landing({ onEnter }: { onEnter?: () => void }) {
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function start() {
    if (wish.trim()) localStorage.setItem('rift_wish', wish.trim());
    if (onEnter) {
      onEnter();
      return;
    }
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setMessage('Не удалось войти через Google: ' + error.message);
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start();
  }

  return (
    <div className="hero2">
      <nav className="hero-nav">
        <div className="hero-logo">
          Amethyst<span>AI</span>
        </div>
        <div className="hero-links">
          <a href="#plus">Amethyst Plus</a>
        </div>
        <button className="nav-open" onClick={start} disabled={busy}>
          {onEnter ? 'Открыть чат →' : 'Войти'}
        </button>
      </nav>

      <header className="hero-center">
        <div className="hero-logo-big">
          <AmethystLogo size={64} />
        </div>
        <div className="hero-pill">
          <span className="dot" /> Умный ИИ-ассистент
        </div>

        <h1 className="hero-h1">
          Amethyst — твой <span>ИИ</span>
          <br />
          для любых задач
        </h1>
        <p className="hero-p">
          Код, объяснения, идеи, отладка — в одном чате. Быстро, точно и красиво.
        </p>

        <button className="google-btn" onClick={start} disabled={busy}>
          {busy ? <span className="spinner" /> : <GoogleIcon />}
          {onEnter ? 'Открыть Amethyst' : 'Войти через Google'}
        </button>
        <p className="cta-note">Без паролей — вход за пару секунд.</p>

        <form className="composer" onSubmit={onSubmit}>
          <textarea
            className="composer-input"
            placeholder="Можешь сразу написать запрос…"
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            rows={2}
          />
          <div className="composer-bar">
            <span style={{ flex: 1 }} />
            <button type="submit" className="composer-cta" disabled={busy}>
              {onEnter ? 'Открыть' : 'Начать'}
            </button>
          </div>
        </form>

        {message && <p className="message hero-msg">{message}</p>}
      </header>

      {/* Amethyst Plus — характеристики */}
      <section className="features" id="plus">
        <div className="plus-head">
          <span className="plus-chip">
            <Icon name="star" size={14} /> Amethyst Plus
          </span>
          <h2 className="features-h">Больше возможностей с Plus</h2>
          <p className="plus-sub">Активируется по коду. Открывает функции — модель остаётся одна, Amethyst.</p>
        </div>
        <div className="features-grid">
          {PLUS_PERKS.map((p) => (
            <div key={p.title} className="feature-card">
              <div className="feature-gem">
                <Icon name={p.icon} size={22} />
              </div>
              <div className="feature-title">{p.title}</div>
              <div className="feature-text">{p.text}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">Amethyst AI · работает на Gemini</footer>
    </div>
  );
}
