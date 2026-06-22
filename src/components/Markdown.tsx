import React, { useState } from 'react';

// Лёгкий безопасный рендер markdown (без сторонних библиотек, без dangerouslySetInnerHTML).
// **жирный**, `код`, [ссылки](url), ```блоки кода``` с подсветкой и копированием, заголовки, списки.

// ── Подсветка кода (универсальная, без зависимостей) ──
const TOKEN =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|\b(const|let|var|function|return|if|else|elif|for|while|class|import|export|from|new|await|async|def|print|public|private|void|int|float|string|str|bool|boolean|true|false|null|None|True|False|in|of|try|except|catch|finally|throw|this|self|interface|type|enum)\b/g;

function highlight(code: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code)) !== null) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? 'tk-com' : m[2] ? 'tk-str' : m[3] ? 'tk-num' : 'tk-kw';
    out.push(
      <span key={key++} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }
  return (
    <div className="code-block">
      <div className="code-head">
        <span className="code-lang">{lang || 'code'}</span>
        <button className="code-copy" onClick={copy}>
          {copied ? '✓ скопировано' : 'копировать'}
        </button>
      </div>
      <pre className="md-pre">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}

// Разбор строки: **жирный**, `код`, [текст](url).
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('`')) {
      nodes.push(<code key={key++} className="md-code">{tok.slice(1, -1)}</code>);
    } else {
      const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const label = link?.[1] ?? tok;
      const href = link?.[2] ?? '';
      if (/^https?:\/\//i.test(href)) {
        nodes.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="md-link">
            {label}
          </a>,
        );
      } else {
        nodes.push(tok);
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let code: string[] | null = null;
  let codeLang = '';
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{renderInline(it)}</li>);
    blocks.push(
      list.type === 'ol' ? (
        <ol key={key++} className="md-list">{items}</ol>
      ) : (
        <ul key={key++} className="md-list">{items}</ul>
      ),
    );
    list = null;
  };

  const isSep = (l: string) => /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(l);
  const cells = (l: string) =>
    l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Таблица: строка с | и следующая — разделитель |---|---|
    if (!code && raw.includes('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      flushList();
      const header = cells(raw);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(cells(lines[i]));
        i++;
      }
      i--; // компенсируем for++
      blocks.push(
        <div key={key++} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>{header.map((h, hi) => <th key={hi}>{renderInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci}>{renderInline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (raw.trim().startsWith('```')) {
      if (code) {
        blocks.push(<CodeBlock key={key++} code={code.join('\n')} lang={codeLang} />);
        code = null;
        codeLang = '';
      } else {
        flushList();
        code = [];
        codeLang = raw.trim().slice(3).trim();
      }
      continue;
    }
    if (code) {
      code.push(raw);
      continue;
    }

    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);

    if (bullet) {
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(numbered[1]);
    } else if (heading) {
      flushList();
      blocks.push(<p key={key++} className="md-h">{renderInline(heading[1])}</p>);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      blocks.push(<p key={key++} className="md-p">{renderInline(line)}</p>);
    }
  }
  flushList();
  if (code) blocks.push(<CodeBlock key={key++} code={code.join('\n')} lang={codeLang} />);

  return <>{blocks}</>;
}
