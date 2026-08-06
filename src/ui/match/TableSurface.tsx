import type { Suit } from "@shared/game";
import type { TableThemeId } from "@/store/settingsStore";
import type { CSSProperties } from "react";
import { SUIT_COLOR } from "@/ui/cards/suitColors";
import { SuitPath } from "@/ui/cards/suits";
import { TABLE_TILT_DEG } from "./room/roomGeometry";

/**
 * Procedural casino table — leather rail, lit felt, gold inlay, grain.
 * Scene skins (`roomStyle: "scene"`) hide this and paint the table in the
 * backdrop instead.
 */
export function TableSurface({
  theme: _theme,
  trumpSuit,
  reflection = true,
}: {
  theme?: TableThemeId;
  trumpSuit?: Suit | null;
  /** Off on the `low` room tier — the blur behind it is the expensive part. */
  reflection?: boolean;
}) {
  return (
    <div className="absolute inset-0" style={{ containerType: "size" }}>
      <FloorGlow />

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          "perspective": "1500px",
          "perspectiveOrigin": "50% 18%",
          // Wide racetrack oval (~2.05:1). Fill the felt on the limiting axis.
          "--tbl-w": "min(90cqw, 1680px, calc(86cqh * 2.05))",
          "--tbl-h": "calc(var(--tbl-w) / 2.05)",
        } as CSSProperties}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-[50%] bg-black/60 blur-2xl"
          style={{
            width: "calc(var(--tbl-w) * 0.98)",
            height: "calc(var(--tbl-h) * 0.76)",
            transform: "translate(-50%, calc(-50% + 13%))",
          }}
        />

        {reflection && <TableReflection />}

        <div
          className="relative shrink-0 rounded-[999px]"
          style={{
            width: "var(--tbl-w)",
            height: "var(--tbl-h)",
            transform: `rotateX(${TABLE_TILT_DEG}deg)`,
            transformOrigin: "50% 50%",
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
            <div
              className="absolute inset-0 rounded-[999px] opacity-[0.05] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />

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

            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[999px]"
              style={{
                width: "clamp(140px, 34cqmin, 420px)",
                height: "clamp(90px, 22cqmin, 270px)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 40px rgba(0,0,0,0.25)",
              }}
            />

            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.1]"
              style={{ width: "clamp(100px, 13cqmin, 200px)", aspectRatio: "1" }}
            >
              <BrandMedallion />
            </div>

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

            <SeatMarker side="top" />
            <SeatMarker side="bottom" />
          </div>

          <div
            className="pointer-events-none absolute rounded-[999px] mix-blend-screen"
            style={{
              inset: "0%",
              background:
                "radial-gradient(ellipse 60% 22% at 50% 6%, rgba(255,255,255,0.22) 0%, transparent 70%)",
            }}
          />

          <div
            className="pointer-events-none absolute rounded-[999px]"
            style={{
              inset: "1.4%",
              border: "1px dashed rgba(255,255,255,0.14)",
            }}
          />

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

function TableReflection() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 rounded-[50%] blur-2xl"
      style={{
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
