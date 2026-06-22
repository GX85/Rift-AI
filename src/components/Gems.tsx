// Логотип Amethyst AI — пиксельный аметист в стиле Minecraft (фиолетовый кристалл-шард).
// Чёткие квадраты-пиксели: блик слева, средняя грань, тёмная правая кромка.

const G = 13;
const CX = (G - 1) / 2;
// Палитра аметиста (как в Minecraft): блик / лево / центр / право / тёмная кромка.
const EDGE = '#ede9fe';
const LEFT = '#c084fc';
const MID = '#a855f7';
const RIGHT = '#7c3aed';
const DARK = '#5b21b6';

export function AmethystLogo({ size = 28 }: { size?: number }) {
  const rects: JSX.Element[] = [];
  for (let r = 0; r < G; r++) {
    // Профиль шарда: остриё сверху → расширение → длинное остриё снизу.
    const hw = r <= 6 ? -0.4 + r * 1.0 : 5.6 - (r - 6) * 0.95;
    if (hw <= 0) continue;
    const cols: number[] = [];
    for (let c = 0; c < G; c++) if (Math.abs(c - CX) <= hw) cols.push(c);
    if (!cols.length) continue;
    const min = cols[0];
    const max = cols[cols.length - 1];
    for (const c of cols) {
      const dx = c - CX;
      let fill = MID;
      if (c === min) fill = EDGE;
      else if (c === max) fill = DARK;
      else if (dx < -0.5) fill = LEFT;
      else if (dx > 0.5) fill = RIGHT;
      rects.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill={fill} />);
    }
  }
  return (
    <span className="amlogo" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${G} ${G}`} shapeRendering="crispEdges">
        {rects}
      </svg>
    </span>
  );
}
