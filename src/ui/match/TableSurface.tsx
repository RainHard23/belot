import type { Suit } from "@shared/game";
import { SUIT_COLOR } from "@/ui/cards/suitColors";
import { SuitPath } from "@/ui/cards/suits";

/**
 * Procedural casino table — leather rail, lit felt, gold inlay, grain
 * texture, brand medallion. No raster image, so it scales crisply and never
 * shows a background box.
 *
 * Fills its positioned ancestor (`absolute inset-0`); sizes itself to fit
 * both axes of that box via container query units, so it never crops.
 */
export function TableSurface({
  trumpSuit,
}: {
  trumpSuit?: Suit | null;
}) {
  return (
    <div className="absolute inset-0" style={{ containerType: "size" }}>
      {/* Contact shadow on the room floor */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-black/55 blur-2xl"
        style={{
          width: "min(90cqw, calc(76cqh * 1.72))",
          aspectRatio: "1.72",
          transform: "translate(-50%, calc(-50% + 4%))",
        }}
      />

      {/* Rail */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[999px]"
        style={{
          width: "min(94cqw, calc(80cqh * 1.72))",
          aspectRatio: "1.72",
          background:
            "linear-gradient(180deg, var(--rail-hi) 0%, var(--rail-mid) 52%, var(--rail-lo) 100%)",
          boxShadow: [
            "inset 0 3px 0 rgba(255,255,255,.16)",
            "inset 0 -14px 30px rgba(0,0,0,.65)",
            "0 50px 90px rgba(0,0,0,.7)",
          ].join(", "),
        }}
      >
        {/* Felt */}
        <div
          className="absolute rounded-[999px]"
          style={{
            inset: "3.6%",
            background: [
              "radial-gradient(ellipse at 50% 20%, rgba(255,255,255,.10) 0%, transparent 55%)",
              "radial-gradient(ellipse at 50% 42%, var(--felt-hi) 0%, var(--felt-mid) 48%, var(--felt-lo) 100%)",
            ].join(", "),
            boxShadow:
              "inset 0 0 70px rgba(0,0,0,.55), inset 0 12px 30px rgba(0,0,0,.35)",
          }}
        >
          {/* Felt grain */}
          <div
            className="absolute inset-0 rounded-[999px] opacity-[0.05] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          {/* Gold inlay hairline */}
          <div
            className="absolute rounded-[999px]"
            style={{
              inset: "6%",
              border: "1px solid rgba(251,158,29,0.22)",
            }}
          />
          <div
            className="absolute rounded-[999px]"
            style={{
              inset: "6.6%",
              border: "1px solid rgba(0,0,0,0.25)",
            }}
          />

          {/* Brand medallion */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.08]">
            <BrandMedallion size={132} />
          </div>

          {/* Trump engraving */}
          {trumpSuit && (
            <div className="absolute left-1/2 top-[27%] flex -translate-x-1/2 items-center gap-1.5 text-white/[0.09]">
              <svg viewBox="0 0 24 24" width={18} height={18} fill={SUIT_COLOR[trumpSuit]} opacity={0.5}>
                <SuitPath suit={trumpSuit} />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BrandMedallion({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="57" stroke="var(--gold-2)" strokeWidth="1.5" />
      <path d="M60 12 98 60 60 108 22 60Z" stroke="var(--gold-2)" strokeWidth="1.5" />
      <text
        x="60"
        y="72"
        textAnchor="middle"
        fontSize="36"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fill="var(--gold-2)"
      >
        Б
      </text>
    </svg>
  );
}
