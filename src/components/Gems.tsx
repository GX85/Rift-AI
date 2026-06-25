export function AmethystLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="amlogo" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 64 64" role="img" focusable="false">
        <defs>
          <linearGradient id="amethystBody" x1="10" y1="8" x2="54" y2="58">
            <stop offset="0" stopColor="#fff7ff" />
            <stop offset="0.18" stopColor="#ff57f0" />
            <stop offset="0.48" stopColor="#8b5cf6" />
            <stop offset="0.74" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#67e8f9" />
          </linearGradient>
          <linearGradient id="amethystCore" x1="20" y1="14" x2="42" y2="52">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.42" stopColor="#c084fc" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
          <filter id="amethystGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.6" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.55  0 1 0 0 0.22  0 0 1 0 1  0 0 0 .72 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#amethystGlow)">
          <path d="M32 4 55 21 48 48 32 61 16 48 9 21 32 4Z" fill="url(#amethystBody)" />
          <path d="M32 4 43 22 32 61 21 22 32 4Z" fill="url(#amethystCore)" opacity=".86" />
          <path d="M9 21h23L16 48 9 21Z" fill="#f35cff" opacity=".72" />
          <path d="M55 21H32l16 27 7-27Z" fill="#2dd4ff" opacity=".72" />
          <path d="M21 22h22L32 32 21 22Z" fill="#ffffff" opacity=".64" />
          <path d="M32 32 48 48 32 61V32Z" fill="#4338ca" opacity=".52" />
          <path d="M32 32 16 48 32 61V32Z" fill="#a855f7" opacity=".58" />
          <path d="M32 4 55 21 48 48 32 61 16 48 9 21 32 4Z" fill="none" stroke="#ffffff" strokeOpacity=".76" strokeWidth="2.2" />
          <path d="M32 7v52M12 22h40M18 47l14-15 14 15" fill="none" stroke="#0b1020" strokeOpacity=".24" strokeWidth="1.4" />
        </g>
      </svg>
    </span>
  );
}
