import type { Rank, Suit } from "@shared/game";
import { NINE_LAYOUT, TEN_LAYOUT } from "./pips";
import { SUIT_COLOR } from "./suitColors";
import { SuitPath } from "./suits";

const COURT_RANKS = new Set<Rank>(["J", "Q", "K"]);

/** Own SVG playing-card face — no raster assets, crisp at any size. */
export function CardFace({ rank, suit }: { rank: Rank; suit: Suit }) {
  const color = SUIT_COLOR[suit];
  const pipLayout = rank === "9" ? NINE_LAYOUT : rank === "10" ? TEN_LAYOUT : null;

  return (
    <svg viewBox="0 0 240 336" className="h-full w-full" role="img" aria-label={`${rank} ${suit}`}>
      <defs>
        <filter id="cardGrain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" seed="7" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.025 0" />
        </filter>
      </defs>

      <rect x="2" y="2" width="236" height="332" rx="14" fill="#F7F5EE" stroke="#D9D2C2" strokeWidth="2" />
      <rect x="2" y="2" width="236" height="332" rx="14" filter="url(#cardGrain)" />
      <rect x="11" y="11" width="218" height="314" rx="9" fill="none" stroke={color} strokeOpacity="0.14" strokeWidth="1.25" />

      <Corner rank={rank} suit={suit} color={color} />
      <g transform="translate(240,336) rotate(180)">
        <Corner rank={rank} suit={suit} color={color} />
      </g>

      {rank === "A" && (
        <g transform="translate(120,168)">
          <circle r="64" fill="none" stroke={color} strokeOpacity="0.18" strokeWidth="1.5" />
          <circle r="52" fill="none" stroke={color} strokeOpacity="0.1" strokeWidth="1" />
          <g fill={color} transform="scale(3.4) translate(-12,-12)">
            <SuitPath suit={suit} />
          </g>
        </g>
      )}

      {pipLayout && (
        <g fill={color}>
          {pipLayout.map((p, i) => {
            const flip = p.y > 50;
            const cx = (p.x / 100) * 240;
            const cy = (p.y / 100) * 336;
            return (
              <g
                key={i}
                transform={`translate(${cx} ${cy}) ${flip ? "rotate(180)" : ""} scale(1.55) translate(-12,-12)`}
              >
                <SuitPath suit={suit} />
              </g>
            );
          })}
        </g>
      )}

      {COURT_RANKS.has(rank) && (
        <CourtBody rank={rank as "J" | "Q" | "K"} suit={suit} color={color} />
      )}
    </svg>
  );
}

function Corner({ rank, suit, color }: { rank: Rank; suit: Suit; color: string }) {
  return (
    <g transform="translate(20,20)" fill={color}>
      <text
        x="0"
        y="20"
        fontSize="32"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
      >
        {rank}
      </text>
      <g transform="translate(1,30) scale(0.85)">
        <SuitPath suit={suit} />
      </g>
    </g>
  );
}

const COURT_MOTIF: Record<"J" | "Q" | "K", (color: string) => React.ReactNode> = {
  K: color => (
    <path
      d="M-20,-46 -12,-30 -4,-44 4,-44 12,-30 20,-46 20,-34 -20,-34Z"
      fill={color}
      opacity="0.85"
    />
  ),
  Q: color => (
    <path
      d="M-22,-38C-14,-50 14,-50 22,-38 14,-42 -14,-42 -22,-38Z"
      fill={color}
      opacity="0.78"
    />
  ),
  J: color => (
    <path d="M-14,-40 14,-40 6,-26 -6,-26Z" fill={color} opacity="0.78" />
  ),
};

function CourtBody({ rank, suit, color }: { rank: "J" | "Q" | "K"; suit: Suit; color: string }) {
  return (
    <g transform="translate(120,168)">
      <path
        d="M0,-96 58,-38 58,38 0,96 -58,38 -58,-38Z"
        fill="none"
        stroke={color}
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M0,-78 46,-30 46,30 0,78 -46,30 -46,-30Z"
        fill="none"
        stroke={color}
        strokeOpacity="0.14"
        strokeWidth="1"
      />

      {COURT_MOTIF[rank](color)}

      <text
        x="0"
        y="26"
        textAnchor="middle"
        fontSize="84"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fill={color}
      >
        {rank}
      </text>

      <g transform="translate(0,58) scale(1.5) translate(-12,-12)" fill={color}>
        <SuitPath suit={suit} />
      </g>
    </g>
  );
}
