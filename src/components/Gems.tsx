export function AmethystLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="amlogo" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 16 16" role="img" focusable="false">
        <path className="gem-shadow" d="M6 1h5v1h2v2h2v5h-2v2h-2v2H9v2H7v-2H5v-2H3V9H1V4h2V2h3z" />
        <path className="gem-outline" d="M5 0h6v1h2v2h2v6h-2v3h-2v2H9v2H7v-2H5v-2H3V9H1V3h2V1h2z" />
        <path className="gem-dark" d="M5 1h6v1h2v2h1v4h-1v3h-2v2H9v2H7v-2H5v-2H3V8H2V4h1V2h2z" />
        <path className="gem-left" d="M5 2h2v2H5v2H3V4h2zM3 6h4v3H4V8H3zM5 9h2v3H5z" />
        <path className="gem-core" d="M7 2h3v2h1v5H9v3H7V9H5V6h2z" />
        <path className="gem-right" d="M10 2h1v1h2v3h-2v4H9V4h1zM9 10h2v2H9z" />
        <path className="gem-hi" d="M6 3h2v2H6zM8 2h2v1H8zM5 6h2v1H5z" />
        <path className="gem-cyan" d="M8 5h2v3H8zM7 8h2v2H7z" />
        <path className="gem-spark" d="M12 4h1v1h-1zM4 3h1v1H4zM6 12h1v1H6z" />
      </svg>
    </span>
  );
}
