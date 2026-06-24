export function AmethystLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="amlogo" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 16 16" role="img" focusable="false">
        <path className="gem-glow" d="M7 0h2v2h2v2h2v2h2v4h-2v2h-2v2H9v2H7v-2H5v-2H3v-2H1V6h2V4h2V2h2z" />
        <path className="gem-shadow" d="M8 1h2v2h2v2h2v4h-2v2h-2v2H8v2H6v-2H4v-2H2V7h2V5h2V3h2z" />
        <path className="gem-outline" d="M7 0h2v2h2v2h2v2h2v4h-2v2h-2v2H9v2H7v-2H5v-2H3v-2H1V6h2V4h2V2h2z" />
        <path className="gem-left" d="M7 2h1v12H6v-2H4v-2H2V6h2V4h2V2z" />
        <path className="gem-core" d="M8 2h2v2h1v2h1v3h-1v2h-1v2H8z" />
        <path className="gem-right" d="M10 4h2v2h2v4h-2v2h-2v2H9v-4h1z" />
        <path className="gem-hi" d="M6 3h2v2H5V4h1zM4 6h3v2H3V7h1z" />
        <path className="gem-cyan" d="M9 6h2v4H9z" />
        <path className="gem-spark" d="M12 5h1v1h-1zM5 2h1v1H5z" />
      </svg>
    </span>
  );
}
