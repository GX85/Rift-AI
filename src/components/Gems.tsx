export function AmethystLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="amlogo" style={{ width: size, height: size }} aria-hidden>
      <img src="/amethyst-logo-pixel.svg?v=20260623-logo" alt="" draggable="false" />
    </span>
  );
}
