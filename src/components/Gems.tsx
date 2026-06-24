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

export function AmethystNavigatorStone({ size = 140 }: { size?: number }) {
  return (
    <span className="amnav-stone" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 180 220" role="img" focusable="false">
        <defs>
          <linearGradient id="navStoneMain" x1="24" y1="8" x2="154" y2="210">
            <stop offset="0" stopColor="#fff7ff" />
            <stop offset="0.16" stopColor="#ff62ec" />
            <stop offset="0.42" stopColor="#955cff" />
            <stop offset="0.66" stopColor="#3f7bff" />
            <stop offset="0.84" stopColor="#55e6ff" />
            <stop offset="1" stopColor="#17092f" />
          </linearGradient>
          <linearGradient id="navStoneDeep" x1="90" y1="0" x2="90" y2="220">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".88" />
            <stop offset=".34" stopColor="#d946ef" stopOpacity=".5" />
            <stop offset="1" stopColor="#1e1b4b" stopOpacity=".96" />
          </linearGradient>
          <filter id="navStoneGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 .75  0 1 0 0 .24  0 0 1 0 1  0 0 0 .85 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#navStoneGlow)">
          <path
            d="M89 5 134 26 174 78 146 156 98 214 82 180 43 215 7 151 18 72 49 25 89 5Z"
            fill="url(#navStoneMain)"
          />
          <path d="M89 5 108 75 98 214 82 180 72 76 89 5Z" fill="url(#navStoneDeep)" opacity=".9" />
          <path d="M18 72 72 76 43 215 7 151 18 72Z" fill="#f05cff" opacity=".46" />
          <path d="M108 75 174 78 146 156 98 214 108 75Z" fill="#55e6ff" opacity=".38" />
          <path d="M49 25 89 5 72 76 18 72 49 25Z" fill="#ffffff" opacity=".55" />
          <path d="M89 5 134 26 174 78 108 75 89 5Z" fill="#c084fc" opacity=".58" />
          <path d="M72 76 108 75 98 214 82 180 72 76Z" fill="#6d28d9" opacity=".65" />
          <path
            d="M89 5 134 26 174 78 146 156 98 214 82 180 43 215 7 151 18 72 49 25 89 5Z"
            fill="none"
            stroke="#fff7ff"
            strokeOpacity=".82"
            strokeWidth="3"
          />
          <path
            d="M72 76 108 75M89 5l-17 71M89 5l19 70M18 72l54 4M108 75l66 3M43 215l29-139M98 214l10-139M82 180l16 34M34 128l42-13M121 125l34-26"
            fill="none"
            stroke="#120822"
            strokeOpacity=".28"
            strokeWidth="2"
          />
          <path
            d="M64 48 78 41M112 40l13 7M48 143l16-5M132 150l20-18"
            fill="none"
            stroke="#ffffff"
            strokeOpacity=".72"
            strokeWidth="4"
            strokeLinecap="square"
          />
        </g>
      </svg>
    </span>
  );
}
