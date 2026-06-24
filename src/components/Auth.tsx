import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icon } from './Icons';
import { AmethystLogo, AmethystNavigatorStone } from './Gems';

// Возможности (бесплатно) и привилегии Plus — для главного экрана.
const PLUS_PERKS = [
  { icon: 'star', title: 'Без лимитов', text: 'Сколько угодно сообщений — у бесплатного есть лимит.' },
  { icon: 'globe', title: 'MVP и сайты', text: 'Опиши продукт — Amethyst соберёт структуру, лендинг и готовый HTML.' },
  { icon: 'attach', title: 'Разбор кода', text: 'Прикрепляй файлы, ищи ошибки и получай понятные исправления.' },
  { icon: 'memory', title: 'Бизнес-память', text: 'Amethyst помнит факты о проекте, клиентах и целях во всех чатах.' },
  { icon: 'volume', title: 'Питчи и тексты', text: 'Генерируй офферы, CTA, сообщения для продаж и короткие презентации.' },
  { icon: 'image', title: 'Визуалы для продукта', text: 'Создавай иконки, hero-изображения и материалы для лендинга.' },
  { icon: 'game', title: 'Прототипы', text: 'Быстро проверяй идеи через интерактивные HTML-прототипы.' },
];

const ACCESS_CODES = ['itsamethyst', 'amethystai', 'amethystplus'];

const LANDING_PROMPTS = [
  'Создай MVP приложения для моей идеи',
  'Собери лендинг одним HTML-файлом',
  'Найди ошибку в React/TypeScript коде',
  'Сделай игру для браузера с touch-управлением',
];

const REVIEWS = [
  {
    name: 'Айбар',
    role: 'ученик nFactorial Teens',
    text: 'Amethyst помог быстро собрать прототип сайта и объяснил код нормальным языком.',
  },
  {
    name: 'Алия',
    role: 'начинающий разработчик',
    text: 'Больше всего понравились подсказки по TypeScript и понятный план, как превратить идею в MVP.',
  },
  {
    name: 'Данияр',
    role: 'запускает мини-стартап',
    text: 'Попросил бизнес-модель, получил оффер, первые шаги продаж и структуру лендинга.',
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
        <div className="hero-fractal-stage platform-gem" aria-hidden>
          <AmethystLogo size={126} />
        </div>
        <p className="platform-kicker"><AmethystLogo size={24} /> Amethyst AI</p>
        <h1>Выбери вход</h1>
        <p className="platform-sub">
          Укажи, откуда заходишь. Amethyst откроет подходящую версию платформы.
        </p>
        <div className="platform-flow" aria-label="Порядок входа">
          <span>Платформа</span>
          <i />
          <span>Главный экран</span>
          <i />
          <span>Amethyst AI</span>
        </div>
        <div className="platform-detect">
          Сейчас похоже на: <b>{phoneLike ? 'телефон / планшет' : 'компьютер'}</b>
        </div>

        <div className="platform-showcase" aria-hidden>
          <div className="platform-window">
            <div className="platform-window-top">
              <span />
              <span />
              <span />
              <b>amethyst.ai</b>
            </div>
            <div className="platform-window-body">
              <div>
                <strong>Готовый результат</strong>
                <small>код, сайт, игра или бизнес-план прямо из чата</small>
              </div>
              <i />
            </div>
          </div>
          <div className="platform-score">
            <b>Gemini 2.5 Flash</b>
            <span>быстрее пишет, лучше собирает, понятнее объясняет</span>
          </div>
        </div>

        <div className="platform-grid">
          <button className={`platform-card ${!phoneLike ? 'recommended' : ''}`} onClick={onDesktop}>
            {!phoneLike && <span className="platform-badge">Рекомендуется</span>}
            <span className="platform-icon">⌘</span>
            <strong>Войти с компьютера</strong>
            <small>Полная web-версия: чат, сайты, игры, картинки, отзывы и Plus.</small>
          </button>
          <button className={`platform-card phone ${phoneLike ? 'recommended' : ''}`} onClick={onPhone}>
            {phoneLike && <span className="platform-badge">Рекомендуется</span>}
            <span className="platform-icon">▯</span>
            <strong>Войти с телефона</strong>
            <small>Если ты на телефоне, откроется мобильное приложение. Если на ПК, появится QR.</small>
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
      <div className="hero-bg" aria-hidden>
        <div className="hero-grid" />
        <div className="hero-vignette" />
      </div>
      <nav className="hero-nav">
        <div className="hero-logo">
          <AmethystLogo size={34} />
          Amethyst<span>AI</span>
        </div>
        <div className="hero-links">
          <a href="#plus">Продукт</a>
          <a href="#plus">Возможности</a>
          <a href="#plus">Для Google</a>
          <a href="/reviews">Отзывы</a>
        </div>
        <button className="nav-open" onClick={start} disabled={busy}>
          {onEnter ? 'Войти' : 'Войти'}
        </button>
      </nav>

      <header className="hero-center">
        <div className="hero-fractal-stage" aria-hidden>
          <AmethystLogo size={126} />
        </div>
        <div className="hero-pill">
          <span className="dot" /> ИИ-ассистент для кода, сайтов и бизнеса
        </div>

        <h1 className="hero-h1">
          Превратите идею в <span>приложение</span>
          <br />
          и бизнес
        </h1>
        <p className="hero-p">
          Amethyst работает на Gemini и помогает писать код, чинить ошибки, собирать MVP, лендинги, web-app прототипы и планы продаж.
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
          {busy ? <span className="spinner" /> : onEnter ? <AmethystLogo size={24} /> : <GoogleIcon />}
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
              {onEnter && <AmethystLogo size={20} />}
              {onEnter ? 'Открыть' : 'Создать'}
            </button>
          </div>
        </form>

        <div className="hero-prompt-grid" aria-label="Быстрые запросы">
          {LANDING_PROMPTS.map((prompt) => (
            <button key={prompt} type="button" onClick={() => setWish(prompt)}>
              <Icon name="spark" size={14} />
              <span>{prompt}</span>
            </button>
          ))}
        </div>

        <div className="hero-platforms" aria-label="Основные возможности">
          <span>React</span>
          <span>TypeScript</span>
          <span>Supabase</span>
          <span>Vercel</span>
          <span>Gemini</span>
          <span>MVP</span>
        </div>

        {message && <p className="message hero-msg">{message}</p>}
      </header>

      {/* Amethyst Plus — характеристики */}
      <section className="features" id="plus">
        <div className="plus-head">
          <span className="plus-chip">
            <Icon name="star" size={14} /> Amethyst Plus
          </span>
          <h2 className="features-h">Больше силы для проектов</h2>
          <p className="plus-sub">Активируется по коду. Открывает больше функций для разработки, MVP и бизнес-задач.</p>
        </div>
        <div className="features-grid">
          {PLUS_PERKS.map((p) => (
            <div key={p.title} className="feature-card">
              <div className="feature-gem">
                <AmethystNavigatorStone size={74} />
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
          <AmethystLogo size={34} />
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
