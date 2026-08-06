import type { Suit } from "@shared/game";
import type { CSSProperties } from "react";
import { SUIT_COLOR } from "@/ui/cards/suitColors";
import { SuitPath } from "@/ui/cards/suits";
import { TABLE_TILT_DEG } from "./room/roomGeometry";

/**
 * Procedural casino table — leather rail, lit felt, gold inlay, grain
 * texture, brand medallion. No raster image, so it scales crisply and never
 * shows a background box.
 *
 * The felt/rail plane sits inside a real CSS 3D `perspective` + `rotateX`
 * tilt (an actual browser 3D transform, not a drawn illusion). The room it
 * stands in — floor plane, walls, ceiling, lighting — is drawn behind by
 * `RoomStage`; this component owns the table plus what the table itself puts
 * on the floor (its contact shadow and its reflection). The shared tilt lives
 * in `room/roomGeometry.ts` so the table and the room's floor agree.
 * Seats/cards/HUD stay outside this tilted plane (rendered by MatchScreen as
 * normal flat 2D), so gameplay stays perfectly readable and untouched by the
 * 3D transform.
 *
 * Fills its positioned ancestor (`absolute inset-0`); sizes itself to fit
 * both axes of that box via container query units, so it never crops.
 */
export function TableSurface({
  trumpSuit,
  reflection = true,
}: {
  trumpSuit?: Suit | null;
  /** Off on the `low` room tier — the blur behind it is the expensive part. */
  reflection?: boolean;
}) {
  return (
    <div className="absolute inset-0" style={{ containerType: "size" }}>
      <FloorGlow />

      {/*
        Camera — everything below is a real 3D-transformed plane, not a drawing.
        --tbl-w/--tbl-h size the table independently on each axis (not one shared
        aspect-ratio funnelled through `min()`), so a short-and-wide viewport
        still gets a wide table instead of shrinking both axes together — the
        oval only backs off its default 1:1.45 shape when the box is too
        narrow/tall to fit it (see the `calc(var(--tbl-w) / 1.45)` guard).
      */}
      <div
        className="absolute inset-0"
        style={{
          "perspective": "1500px",
          "perspectiveOrigin": "50% 18%",
          // Backed off from 94cqw/78cqh: the table was filling the frame
          // edge to edge, which left the room with nowhere to be seen.
          "--tbl-w": "min(88cqw, 1560px)",
          "--tbl-h": "min(74cqh, calc(var(--tbl-w) / 1.55))",
        } as CSSProperties}
      >
        {/* Contact shadow where the table meets the room floor. Squashed and
          * pushed down rather than tilted, which is what a shadow cast on a
          * receding floor looks like from this camera. */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-[50%] bg-black/60 blur-2xl"
          style={{
            width: "calc(var(--tbl-w) * 0.98)",
            height: "calc(var(--tbl-h) * 0.76)",
            transform: "translate(-50%, calc(-50% + 13%))",
          }}
        />

        {reflection && <TableReflection />}

        {/* Rail — tilted back like a real table viewed from above-front */}
        <div
          className="absolute left-1/2 top-1/2 rounded-[999px]"
          style={{
            width: "var(--tbl-w)",
            height: "var(--tbl-h)",
            transform: `translate(-50%, -50%) rotateX(${TABLE_TILT_DEG}deg)`,
            background:
              "linear-gradient(180deg, var(--rail-hi) 0%, var(--rail-mid) 52%, var(--rail-lo) 100%)",
            boxShadow: [
              "inset 0 3px 0 var(--rail-rim)",
              "inset 0 -14px 30px rgba(0,0,0,.65)",
              "0 50px 90px rgba(0,0,0,.7)",
              "var(--table-glow)",
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

            {/* Trick zone — faint inner ring marking where cards land, like a
              * dealt-card mat. Purely decorative, sits well below trick z-index. */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[999px]"
              style={{
                width: "clamp(140px, 34cqmin, 420px)",
                height: "clamp(90px, 22cqmin, 270px)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 40px rgba(0,0,0,0.25)",
              }}
            />

            {/* Brand medallion — scales with the table via cqmin, not a fixed px size */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.1]"
              style={{ width: "clamp(100px, 13cqmin, 200px)", aspectRatio: "1" }}
            >
              <BrandMedallion />
            </div>

            {/* Trump engraving */}
            {trumpSuit && (
              <div className="absolute left-1/2 top-[27%] flex -translate-x-1/2 items-center gap-1.5 text-white/[0.09]">
                <svg
                  viewBox="0 0 24 24"
                  style={{ width: "clamp(18px, 2.2cqmin, 30px)", height: "clamp(18px, 2.2cqmin, 30px)" }}
                  fill={SUIT_COLOR[trumpSuit]}
                  opacity={0.5}
                >
                  <SuitPath suit={trumpSuit} />
                </svg>
              </div>
            )}

            {/* Seat markers — subtle arcs hinting where each hand sits, like
              * felt-printed guide lines on a real table. */}
            <SeatMarker side="top" />
            <SeatMarker side="bottom" />
          </div>

          {/* Specular sheen — wide soft highlight as if a single overhead
            * light were raking across a glossy/leather rail, screen-blended
            * so it never washes out the felt colors underneath. */}
          <div
            className="pointer-events-none absolute rounded-[999px] mix-blend-screen"
            style={{
              inset: "0%",
              background:
                "radial-gradient(ellipse 60% 22% at 50% 6%, rgba(255,255,255,0.22) 0%, transparent 70%)",
            }}
          />

          {/* Leather stitching — dashed line tracing just inside the rail's
            * outer edge, the way a real rail's piping is stitched down. */}
          <div
            className="pointer-events-none absolute rounded-[999px]"
            style={{
              inset: "1.4%",
              border: "1px dashed rgba(255,255,255,0.14)",
            }}
          />

          {/* Neon tube tracing the rail/felt seam — invisible unless the theme sets --neon-ring */}
          <div
            className="pointer-events-none absolute rounded-[999px]"
            style={{
              inset: "3%",
              border: "2px solid var(--neon-ring)",
              boxShadow: "var(--neon-ring-glow)",
              animation: "neon-ring-pulse 2.6s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Faint felt-printed arc hinting at where a hand of cards rests. */
function SeatMarker({ side }: { side: "top" | "bottom" }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 rounded-[999px] opacity-[0.06]"
      style={{
        [side]: "6%",
        width: "clamp(120px, 30cqmin, 340px)",
        height: "clamp(20px, 5cqmin, 56px)",
        border: "1px solid white",
        borderRadius: "50%",
      } as CSSProperties}
    />
  );
}

/**
 * The table's reflection in the floor, in front of its near edge.
 *
 * Deliberately a soft colored smear built from the theme's felt/rail colors
 * rather than a mirrored copy of the table: at this blur radius a literal
 * mirror carries no recoverable detail, and a smear can't drift out of
 * alignment with the rail on odd viewport ratios. `--reflect-opacity` is
 * per-theme and physically motivated — polished black glass reflects hard,
 * parquet barely, and burgundy's carpet essentially not at all.
 */
function TableReflection() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 rounded-[50%] blur-2xl"
      style={{
        top: "50%",
        width: "calc(var(--tbl-w) * 0.94)",
        height: "calc(var(--tbl-h) * 0.42)",
        transform: "translate(-50%, calc(-50% + 52%))",
        opacity: "var(--reflect-opacity)",
        background:
          "radial-gradient(ellipse at 50% 15%, var(--reflect-color) 0%, var(--felt-hi) 48%, transparent 80%)",
        maskImage: "linear-gradient(180deg, rgba(0,0,0,0.95) 0%, transparent 88%)",
      }}
    />
  );
}

/** Soft colored light pooling on the floor under the table's near edge. */
function FloorGlow() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[78%] h-[16%] w-[58%] -translate-x-1/2 rounded-[50%] blur-3xl"
      style={{ background: "var(--floor-glow)" }}
    />
  );
}

function BrandMedallion() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 120 120" fill="none">
      <circle cx="60" cy="60" r="57" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M60 12 98 60 60 108 22 60Z" stroke="var(--accent)" strokeWidth="1.5" />
      <text
        x="60"
        y="72"
        textAnchor="middle"
        fontSize="36"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fill="var(--accent)"
      >
        Б
      </text>
    </svg>
  );
}
