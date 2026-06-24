import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from './Icons';
import { AmethystLogo } from './Gems';

// Возможности Amethyst для главного экрана.
const PLUS_PERKS = [
  { icon: 'attach', title: 'Разбор файлов', text: 'Прикрепляй код, ошибки и логи — Amethyst найдёт причину и даст фикс.' },
  { icon: 'models', title: 'Генерация приложений', text: 'Описываешь web-app — получаешь рабочий HTML-прототип с UI и логикой.' },
  { icon: 'search', title: 'Code review', text: 'Проверка TypeScript, React, архитектуры, edge cases и плохих состояний.' },
  { icon: 'memory', title: 'Контекст проекта', text: 'Amethyst помнит стек, цели и важные решения внутри проекта.' },
  { icon: 'globe', title: 'Frontend ready', text: 'Компоненты, адаптив, состояния загрузки, ошибок и пустых списков.' },
  { icon: 'star', title: 'Gemini внутри', text: 'Gemini как модель, Amethyst как интерфейс и правила для разработки.' },
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
    text: 'Больше всего понравились подсказки по TypeScript и нормальные фиксы без воды.',
  },
  {
    name: 'Данияр',
    role: 'делает web-app',
    text: 'Описал приложение, получил рабочий HTML-прототип с формами, состояниями и адаптивом.',
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
  const phoneLike =
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 820px), (pointer: coarse)').matches ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

  return (
    <main className="platform-page">
      <section className="platform-shell">
        <div className="platform-logo" aria-hidden>
          <AmethystLogo size={96} />
        </div>
        <p className="platform-kicker">Amethyst</p>
        <h1>Выбери вход</h1>
        <p className="platform-sub">
          Укажи, откуда заходишь. Amethyst откроет подходящую версию платформы.
        </p>
        <div className="platform-flow" aria-label="Порядок входа">
          <span>Платформа</span>
          <i />
          <span>Главный экран</span>
          <i />
          <span>AI chat</span>
        </div>
        <div className="platform-detect">
          Сейчас похоже на: <b>{phoneLike ? 'телефон / планшет' : 'компьютер'}</b>
        </div>

        <div className="platform-grid">
          <button className={`platform-card ${!phoneLike ? 'recommended' : ''}`} onClick={onDesktop}>
            {!phoneLike && <span className="platform-badge">Рекомендуется</span>}
            <span className="platform-icon">⌘</span>
            <strong>Войти с компьютера</strong>
            <small>Полная web-версия: кодовый чат, файлы, review, отладка и генерация приложений.</small>
          </button>
          <button className={`platform-card phone ${phoneLike ? 'recommended' : ''}`} onClick={onPhone}>
            {phoneLike && <span className="platform-badge">Рекомендуется</span>}
            <span className="platform-icon">▯</span>
            <strong>Войти с телефона</strong>
            <small>Если ты на телефоне, откроется mobile app. Если на ПК, появится QR.</small>
          </button>
        </div>

        <div className="platform-links">
          <a href="/qr">Показать QR</a>
          <a href="/qr">Mobile QR</a>
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
      <div className="hero-bg" aria-hidden>
        <div className="hero-grid" />
        <div className="hero-vignette" />
      </div>
      <nav className="hero-nav">
        <div className="hero-logo">
          <AmethystLogo size={34} />
          <span className="hero-logo-text">
            Amethyst
          </span>
        </div>
        <div className="hero-links">
          <a href="#plus">Продукт</a>
          <a href="#plus">Код</a>
          <a href="#plus">Сайты</a>
          <a href="/qr">Mobile</a>
        </div>
        <button className="nav-open" onClick={start} disabled={busy}>
          {onEnter ? 'Войти' : 'Войти'}
        </button>
      </nav>

      <header className="hero-center">
        <div className="hero-logo-mark" aria-hidden>
          <AmethystLogo size={118} />
        </div>
        <div className="hero-pill">
          <span className="dot" /> Gemini-powered coding assistant
        </div>

        <h1 className="hero-h1">
          Amethyst для <span>разработки</span>
          <br />
          приложений
        </h1>
        <p className="hero-p">
          Версия Gemini, сфокусированная на коде: пишет компоненты, чинит ошибки, объясняет логику и собирает web-app прототипы.
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
            placeholder="Например: создай адаптивный сайт для AI-продукта одним HTML-файлом..."
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            rows={2}
          />
          <div className="composer-bar">
            <span style={{ flex: 1 }} />
            <button type="submit" className="composer-cta" disabled={busy}>
              {onEnter ? 'Открыть' : 'Создать'}
            </button>
          </div>
        </form>

        <div className="hero-platforms" aria-label="Основные возможности">
          <span>Код</span>
          <span>Apps</span>
          <span>React</span>
          <span>Landing</span>
          <span>Review</span>
          <span>Fixes</span>
        </div>

        {message && <p className="message hero-msg">{message}</p>}
      </header>

      {/* Amethyst — возможности */}
      <section className="features" id="plus">
        <div className="plus-head">
          <span className="plus-chip">
            <Icon name="star" size={14} /> Amethyst
          </span>
          <h2 className="features-h">Кодовый режим без лишнего</h2>
          <p className="plus-sub">Amethyst сфокусирован на разработке: код, файлы, ошибки, архитектура и приложения.</p>
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

      <footer className="landing-footer">Amethyst · работает на Gemini</footer>
    </div>
  );
}

export function ReviewsPage() {
  return (
    <main className="reviews-page">
      <nav className="hero-nav reviews-nav">
        <a className="hero-logo" href="/">
          <AmethystLogo size={34} />
          <span className="hero-logo-text">
            Amethyst
          </span>
        </a>
        <a className="nav-open" href="/">
          Открыть
        </a>
      </nav>

      <section className="reviews-hero">
        <div className="hero-pill">
          <span className="dot" /> Отзывы
        </div>
        <h1 className="reviews-title">Что говорят об Amethyst</h1>
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
