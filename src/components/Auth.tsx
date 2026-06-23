import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from './Icons';

// Возможности (бесплатно) и привилегии Plus — для главного экрана.
const PLUS_PERKS = [
  { icon: 'star', title: 'Без лимитов', text: 'Сколько угодно сообщений — у бесплатного есть лимит.' },
  { icon: 'globe', title: 'Создание сайтов', text: 'Опиши сайт — Amethyst сгенерирует и даст скачать готовый HTML.' },
  { icon: 'game', title: 'Игровая студия', text: 'Играбельные 2D-игры одним запросом, прямо в окне.' },
  { icon: 'image', title: 'Генерация картинок', text: 'Опиши картинку — Amethyst нарисует её и даст скачать.' },
  { icon: 'memory', title: 'Память 20 ГБ', text: 'Amethyst помнит факты о тебе во всех чатах.' },
  { icon: 'volume', title: 'Озвучка и темы', text: 'Голосовое чтение ответов и выбор цвета интерфейса.' },
  { icon: 'attach', title: 'Файлы и длинные ответы', text: 'Прикрепляй файлы и получай развёрнутые ответы.' },
];

const ACCESS_CODES = ['itsamethyst', 'amethystai', 'amethystplus'];

const REVIEWS = [
  {
    name: 'Айбар',
    role: 'ученик nFactorial Teens',
    text: 'Amethyst помог быстро собрать прототип сайта и объяснил код нормальным языком.',
  },
  {
    name: 'Алия',
    role: 'начинающий разработчик',
    text: 'Больше всего понравилась генерация идей для проекта и подсказки по ошибкам в TypeScript.',
  },
  {
    name: 'Данияр',
    role: 'делает игры на HTML',
    text: 'Попросил простую игру, получил готовый HTML с управлением, счётом и рестартом.',
  },
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

export function PlatformChoice({
  onDesktop,
  onPhone,
}: {
  onDesktop: () => void;
  onPhone: () => void;
}) {
  return (
    <main className="platform-page">
      <section className="platform-shell">
        <div className="hero-fractal-stage platform-gem" aria-hidden>
          <div className="fractal-cube">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <p className="platform-kicker">Amethyst AI</p>
        <h1>Выбери вход</h1>
        <p className="platform-sub">
          Укажи, откуда заходишь. Amethyst откроет подходящую версию платформы.
        </p>

        <div className="platform-grid">
          <button className="platform-card" onClick={onDesktop}>
            <span className="platform-icon">⌘</span>
            <strong>Войти с компьютера</strong>
            <small>Полная web-версия: чат, сайты, игры, картинки, отзывы и Plus.</small>
          </button>
          <button className="platform-card phone" onClick={onPhone}>
            <span className="platform-icon">▯</span>
            <strong>Войти с телефона</strong>
            <small>Если ты на телефоне, откроется mobile app. Если на ПК, появится QR.</small>
          </button>
        </div>

        <div className="platform-links">
          <a href="/qr">Показать QR</a>
          <a href="/reviews">Отзывы</a>
        </div>
      </section>
    </main>
  );
}

export function Landing({ onEnter }: { onEnter?: () => void }) {
  const [wish, setWish] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function start() {
    if (onEnter) {
      const normalizedCode = accessCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!ACCESS_CODES.includes(normalizedCode)) {
        setMessage("Введи код доступа: It'sAmethyst, AmethystAI или AmethystPlus.");
        return;
      }
      if (wish.trim()) localStorage.setItem('rift_wish', wish.trim());
      onEnter();
      return;
    }
    if (wish.trim()) localStorage.setItem('rift_wish', wish.trim());
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
          <a href="/reviews">Отзывы</a>
          <a href="/qr">Mobile QR</a>
        </div>
        <button className="nav-open" onClick={start} disabled={busy}>
          {onEnter ? 'Открыть чат →' : 'Войти'}
        </button>
      </nav>

      <header className="hero-center">
        <div className="hero-fractal-stage" aria-hidden>
          <div className="fractal-cube">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="hero-pill">
          <span className="dot" /> Умный ИИ-ассистент
        </div>

        <h1 className="hero-h1">
          Новое видение <span>Искусственного</span>
          <br />
          Интеллекта
        </h1>
        <p className="hero-p">
          Код, объяснения, идеи, отладка — в одном чате. Быстро, точно и красиво.
        </p>

        {onEnter && (
          <input
            className="hero-code-input"
            placeholder="Код доступа"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            autoComplete="one-time-code"
          />
        )}

        <button className="google-btn" onClick={start} disabled={busy}>
          {busy ? <span className="spinner" /> : onEnter ? <span className="code-dot" /> : <GoogleIcon />}
          {onEnter ? 'Открыть Amethyst' : 'Войти через Google'}
        </button>
        <p className="cta-note">{onEnter ? "Коды: It'sAmethyst, AmethystAI, AmethystPlus" : 'Без паролей — вход за пару секунд.'}</p>

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

export function ReviewsPage() {
  return (
    <main className="reviews-page">
      <nav className="hero-nav reviews-nav">
        <a className="hero-logo" href="/">
          Amethyst<span>AI</span>
        </a>
        <a className="nav-open" href="/">
          Открыть
        </a>
      </nav>

      <section className="reviews-hero">
        <div className="hero-pill">
          <span className="dot" /> Отзывы
        </div>
        <h1 className="reviews-title">Что говорят об Amethyst AI</h1>
        <p className="reviews-sub">
          Публичная страница отзывов: её можно открыть без входа, отправить по ссылке или показать через QR-код.
        </p>
      </section>

      <section className="reviews-grid" aria-label="Отзывы пользователей">
        {REVIEWS.map((review) => (
          <article className="review-card" key={review.name}>
            <div className="review-avatar">{review.name.slice(0, 1)}</div>
            <p className="review-text">“{review.text}”</p>
            <div className="review-person">{review.name}</div>
            <div className="review-role">{review.role}</div>
          </article>
        ))}
      </section>
    </main>
  );
}
