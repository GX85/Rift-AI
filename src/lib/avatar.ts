// Детерминированная аватарка агента: по его id выбираем эмодзи и градиент,
// чтобы у каждого агента был свой узнаваемый вид (и он не менялся при перезагрузке).

const EMOJIS = [
  '💠', '🧠', '✨', '🚀', '🎯', '📚', '🎨', '🧪', '⚡', '🦊',
  '🐱', '🌟', '🔮', '🎮', '💡', '🛠️', '🧭', '🎓', '🍀', '🐉',
];

const GRADIENTS = [
  'linear-gradient(135deg, #7c5cff, #4ea8ff)',
  'linear-gradient(135deg, #ff6b9d, #c44fff)',
  'linear-gradient(135deg, #4ea8ff, #2dd4bf)',
  'linear-gradient(135deg, #ffb347, #ff6b6b)',
  'linear-gradient(135deg, #2dd4bf, #4ea8ff)',
  'linear-gradient(135deg, #c44fff, #7c5cff)',
  'linear-gradient(135deg, #ff8a5c, #ffb347)',
  'linear-gradient(135deg, #5cff9d, #2dd4bf)',
];

// Простой стабильный хеш строки в число.
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function avatarFor(seed: string): { emoji: string; gradient: string } {
  const h = hash(seed);
  return {
    emoji: EMOJIS[h % EMOJIS.length],
    gradient: GRADIENTS[h % GRADIENTS.length],
  };
}
