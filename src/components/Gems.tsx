export function AmethystLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="amlogo" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 16 16" role="img" focusable="false">
        <path className="gem-aura" d="M7 0h2v1h2v2h2v2h2v2h1v2h-1v2h-2v2h-2v2H9v1H7v-1H5v-2H3v-2H1v-2H0V7h1V5h2V3h2V1h2z" />
        <path className="gem-edge-light" d="M7 0h2v1h2v2h2v2h2v2h1v2h-1v2h-2v2h-2v2H9v1H7v-1H5v-2H3v-2H1v-2H0V7h1V5h2V3h2V1h2z" />
        <path className="gem-pink" d="M7 1h1v13H6v-2H4v-2H2V6h2V4h2V2h1z" />
        <path className="gem-purple" d="M8 1h1v2h2v2h2v2h1v3h-2v2h-2v2H8z" />
        <path className="gem-deep" d="M11 5h1v2h2v3h-2v2h-2v1H9v-3h1V7h1z" />
        <path className="gem-white" d="M6 2h2v2H5V3h1zM4 5h3v2H2V6h2z" />
        <path className="gem-cyan" d="M9 6h2v4H9z" />
        <path className="gem-spark" d="M12 5h1v1h-1zM5 1h1v1H5zM7 14h2v1H7z" />
      </svg>
    </span>
  );
}
