/** Card back — emerald ground, gold diamond lattice, brand medallion. Themeable via CSS vars. */
export function CardBack() {
  return (
    <svg viewBox="0 0 240 336" className="h-full w-full" role="img" aria-label="card back">
      <defs>
        <linearGradient id="cardBackBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--felt-hi)" />
          <stop offset="100%" stopColor="var(--felt-lo)" />
        </linearGradient>
        <pattern id="cardBackLattice" width="22" height="22" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <path d="M0 11H22M11 0V22" stroke="var(--gold-2)" strokeOpacity="0.15" strokeWidth="1" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="240" height="336" rx="16" fill="url(#cardBackBg)" />
      <rect x="9" y="9" width="222" height="318" rx="12" fill="none" stroke="var(--gold-2)" strokeOpacity="0.4" strokeWidth="1.5" />
      <rect x="9" y="9" width="222" height="318" rx="12" fill="url(#cardBackLattice)" />

      <circle cx="120" cy="168" r="48" fill="none" stroke="var(--gold-2)" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx="120" cy="168" r="40" fill="rgba(0,0,0,0.2)" />
      <path
        d="M120 138 148 168 120 198 92 168Z"
        fill="none"
        stroke="var(--gold-2)"
        strokeOpacity="0.5"
        strokeWidth="1.25"
      />
      <text
        x="120"
        y="180"
        textAnchor="middle"
        fontSize="40"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fill="var(--gold-2)"
        opacity="0.9"
      >
        Б
      </text>
    </svg>
  );
}
