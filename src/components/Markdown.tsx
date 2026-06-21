import React from 'react';

// Лёгкий и безопасный рендер markdown (без сторонних библиотек и без dangerouslySetInnerHTML).
// Поддерживает: **жирный**, `код`, заголовки (#), списки (-, •, 1.) и абзацы.
// Умные модели часто отвечают в markdown — так ответы выглядят аккуратно.

// Разбор строки на куски: **жирный** и `код`.
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={key++} className="md-code">{tok.slice(1, -1)}</code>);
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

  for (const raw of lines) {
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

  return <>{blocks}</>;
}
