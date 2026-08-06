import type { CSSProperties } from "react";
import type { RoomQuality, TableThemeId } from "@/store/settingsStore";
import { useEffect, useRef, useState } from "react";
import { useEffectiveReducedMotion } from "@/store/settingsStore";
import { ASSETS } from "@/ui/assets";
import { subscribeAmbient } from "../ambientBus";
import {
  BACK_WALL_LEFT_PCT,
  BACK_WALL_RIGHT_PCT,
  CEILING_CLIP,
  CEILING_PCT,
  FLOOR_LENGTH,
  FLOOR_TILT_DEG,
  HORIZON_PCT,
  LEFT_WALL_CLIP,
  RIGHT_WALL_CLIP,
  ROOM_PERSPECTIVE,
  ROOM_WIDTH,
  SIDE_WALL_JOINTS,
} from "./roomGeometry";

/** How long a plate crossfade takes when the table theme changes. */
const THEME_FADE_MS = 450;

type Quality = Exclude<RoomQuality, "auto">;

/**
 * The room the table stands in: a real 3D floor plane plus wall, ceiling and
 * light layers, replacing the single stretched photo that used to sit behind
 * everything.
 *
 * Only the floor is an actual 3D-transformed plane, and that's deliberate:
 * it's the one surface whose *material* has to foreshorten (a tiled texture
 * converging toward the horizon is what reads as "floor"). The walls and the
 * ceiling are clipped with `clip-path` polygons that converge on the same
 * vanishing point — for flat, dark, gradient-shaded surfaces that is visually
 * identical to rotated planes, but it can't clip through the camera and it
 * costs one composited layer each instead of a 3D context.
 *
 * See roomGeometry.ts for every number used here.
 */
export function RoomStage({
  theme,
  quality,
}: {
  theme: TableThemeId;
  quality: Quality;
}) {
  const plate = ASSETS.roomBackdrops[theme];
  const previousPlate = useCrossfadedPlate(plate);
  /** Blur layers are the fill-rate hog — the whole point of the low tier. */
  const soft = quality !== "low";

  usePreloadedRoomArt(theme);

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ containerType: "size", background: "var(--room-base)" }}
    >
      <Ceiling />
      <BackWall plate={plate} previousPlate={previousPlate} soft={soft} />
      <SideWall side="left" soft={soft} />
      <SideWall side="right" soft={soft} />

      {/* The only real 3D context in the room. */}
      <div
        className="absolute inset-0"
        style={{
          perspective: ROOM_PERSPECTIVE,
          perspectiveOrigin: `50% ${HORIZON_PCT}%`,
        }}
      >
        <Floor />
      </div>

      <RoomEdges />
      <RoomLight />
      <Vignette />
    </div>
  );
}

/**
 * Tiled material lying down from the horizon toward the camera. The tint is
 * a same-color gradient multiplied over the photo tile, so one grey texture
 * serves every theme instead of four downloads.
 */
function Floor() {
  return (
    <div
      className="absolute left-1/2"
      style={{
        top: `${HORIZON_PCT}%`,
        width: ROOM_WIDTH,
        height: FLOOR_LENGTH,
        transform: `translateX(-50%) rotateX(${FLOOR_TILT_DEG}deg)`,
        transformOrigin: "50% 0%",
        backgroundColor: "var(--floor-base)",
        backgroundImage:
          "linear-gradient(var(--floor-tint), var(--floor-tint)), var(--floor-tex)",
        backgroundSize: "100% 100%, var(--floor-tex-size) var(--floor-tex-size)",
        backgroundBlendMode: "multiply, normal",
        // Transitioning the tint (a color) is free; the raster underneath
        // swaps instantly but is dark enough that the jump doesn't read.
        transition: `background-color ${THEME_FADE_MS}ms ease`,
      } as CSSProperties}
    >
      {/*
        Reflections of the overhead lights, drawn *inside* the plane so the
        perspective converges them for free — this is the polished-floor look
        that reads as "casino", and it's the main thing that keeps the lower
        half of the frame from being a dark void.
      */}
      <div
        className="absolute inset-0"
        style={{
          // Soft stops rather than hard bands, or the streaks read as a
          // wireframe grid instead of light bouncing off a polished floor.
          background:
            "repeating-linear-gradient(90deg, transparent 0 7%, var(--floor-streak) 11% 14%, transparent 18% 25%)",
          maskImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 12%, #000 45%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      {/* Distance shading: dark at the horizon, a lit pool under the table,
        * dark again at the very front where no light reaches. */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "linear-gradient(180deg, var(--horizon-fade) 0%, rgba(0,0,0,0.6) 8%, rgba(0,0,0,0.06) 30%, rgba(0,0,0,0.12) 70%, rgba(0,0,0,0.5) 100%)",
            "radial-gradient(ellipse 46% 30% at 50% 34%, var(--floor-pool) 0%, transparent 72%)",
          ].join(", "),
        }}
      />
    </div>
  );
}

/**
 * Fronto-parallel back wall. Mathematically the correct shape for a
 * centered one-point view, so no transform is needed at all — it carries the
 * theme's photographic plate (cropped to its upper half, where the actual
 * wall detail is) under procedural panel joinery.
 */
function BackWall({
  plate,
  previousPlate,
  soft,
}: {
  plate: string;
  previousPlate: string | null;
  soft: boolean;
}) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: `${BACK_WALL_LEFT_PCT}%`,
        right: `${100 - BACK_WALL_RIGHT_PCT}%`,
        top: `${CEILING_PCT}%`,
        height: `${HORIZON_PCT - CEILING_PCT}%`,
        background: "linear-gradient(180deg, var(--wall-1) 0%, var(--wall-2) 100%)",
      }}
    >
      <PlateLayer src={plate} soft={soft} />
      {previousPlate && <PlateLayer src={previousPlate} soft={soft} fadingOut />}

      {/* Panel joinery — vertical stiles with a lit edge and a shadowed one. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent 0 var(--wall-panel-w), rgba(255,255,255,0.055) var(--wall-panel-w) calc(var(--wall-panel-w) + 1px), rgba(0,0,0,0.5) calc(var(--wall-panel-w) + 1px) calc(var(--wall-panel-w) + 3px))",
        }}
      />
      {/* Chair rail near the bottom, cornice at the top. */}
      <div className="absolute inset-x-0 bottom-[22%] h-px bg-white/[0.07]" />
      <div className="absolute inset-x-0 bottom-[calc(22%-2px)] h-[2px] bg-black/45" />
      <div className="absolute inset-x-0 top-[6%] h-px bg-white/[0.05]" />

      {/* Sconce pools — the wall is lit from two fixtures, not uniformly. */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 16% 46% at 17% 44%, var(--sconce-color) 0%, transparent 72%)",
            "radial-gradient(ellipse 16% 46% at 83% 44%, var(--sconce-color) 0%, transparent 72%)",
            // Vertical light channels, spaced with the panel joinery.
            "repeating-linear-gradient(90deg, transparent 0 calc(var(--wall-panel-w) * 2), var(--wall-strip) calc(var(--wall-panel-w) * 2) calc(var(--wall-panel-w) * 2 + 3px), transparent calc(var(--wall-panel-w) * 2 + 3px) calc(var(--wall-panel-w) * 4))",
          ].join(", "),
        }}
      />
      {/* Baked ambient occlusion: darker where the wall meets ceiling and floor. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.72) 0%, transparent 34%, transparent 62%, rgba(0,0,0,0.66) 100%)",
        }}
      />
    </div>
  );
}

/** Photographic detail behind the joinery, blurred so it never claims geometry. */
function PlateLayer({
  src,
  soft,
  fadingOut,
}: {
  src: string;
  soft: boolean;
  fadingOut?: boolean;
}) {
  return (
    <div
      className="absolute inset-0 bg-cover bg-[position:50%_18%] bg-no-repeat"
      style={{
        backgroundImage: `url(${src})`,
        // Scaled up a touch so the blur doesn't reveal the layer's own edges.
        filter: soft ? "blur(3px) saturate(0.85)" : "saturate(0.85)",
        transform: soft ? "scale(1.08)" : undefined,
        opacity: fadingOut ? 0 : 0.42,
        transition: `opacity ${THEME_FADE_MS}ms ease`,
      }}
    />
  );
}

/**
 * Side wall as a wedge from the screen edge to the back wall's corners. The
 * gradient runs along the wedge so the far end (near the vanishing point) is
 * darkest, which is what gives the corner its depth.
 */
function SideWall({ side, soft }: { side: "left" | "right"; soft: boolean }) {
  const towardCenter = side === "left" ? "90deg" : "270deg";
  return (
    <div
      className="absolute inset-0"
      style={{
        clipPath: side === "left" ? LEFT_WALL_CLIP : RIGHT_WALL_CLIP,
        background: [
          // Light strips (themes that have them) sit nearest the camera,
          // where a real wall sconce or LED channel would actually be.
          `radial-gradient(ellipse 30% 60% at ${side === "left" ? "8%" : "92%"} 46%, var(--wall-strip) 0%, transparent 70%)`,
          `linear-gradient(${towardCenter}, var(--wall-2) 0%, var(--wall-1) 46%, rgba(0,0,0,0.74) 100%)`,
          "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 66%, rgba(0,0,0,0.68) 100%)",
        ].join(", "),
        // Depth of field: the walls are never the subject, the table is.
        filter: soft ? "blur(2px)" : undefined,
      }}
    />
  );
}

/** Ceiling wedge with a cove light along the seam. */
function Ceiling() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          clipPath: CEILING_CLIP,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.92) 0%, var(--wall-2) 78%, var(--wall-1) 100%)",
        }}
      />
      {/* Cove glow spilling down from the seam onto the wall. */}
      <div
        className="absolute inset-x-0"
        style={{
          top: `${CEILING_PCT - 3}%`,
          height: "18%",
          background:
            "radial-gradient(ellipse 46% 100% at 50% 0%, var(--cove-color) 0%, transparent 72%)",
        }}
      />
    </>
  );
}

/**
 * The room's actual edges, in one SVG: the floor line running from the back
 * wall's corners out to the bottom of the frame, the ceiling line doing the
 * same overhead, and the panel joints down each side wall.
 *
 * These lines are what make the geometry legible — without them the shaded
 * wedges just read as dark gradients and the back wall looks like a
 * rectangle pasted onto black. `preserveAspectRatio="none"` lets the
 * coordinates be plain percentages (so they line up with the clip paths at
 * any aspect ratio) while `vector-effect` keeps the strokes from being
 * stretched along with them.
 */
function RoomEdges() {
  const L = BACK_WALL_LEFT_PCT;
  const R = BACK_WALL_RIGHT_PCT;
  const H = HORIZON_PCT;
  const C = CEILING_PCT;

  /** Point along a side wall's floor/ceiling line, t=0 at the back wall. */
  const floorAt = (t: number, left: boolean) => ({
    x: left ? L - L * t : R + (100 - R) * t,
    y: H + (100 - H) * t,
  });
  const ceilAt = (t: number, left: boolean) => ({
    x: left ? L - L * t : R + (100 - R) * t,
    y: C - C * t,
  });

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
    >
      {[true, false].map((left) => {
        const f = floorAt(1, left);
        const c = ceilAt(1, left);
        return (
          <g key={left ? "l" : "r"}>
            {/* Panel joints, back to front. */}
            {SIDE_WALL_JOINTS.map((t) => {
              const a = floorAt(t, left);
              const b = ceilAt(t, left);
              return (
                <line
                  key={t}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--joint-color)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {/* Floor line (bright, it catches the light) and ceiling line. */}
            <line
              x1={left ? L : R}
              y1={H}
              x2={f.x}
              y2={f.y}
              stroke="var(--plinth-hi)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={left ? L : R}
              y1={C}
              x2={c.x}
              y2={c.y}
              stroke="var(--joint-color)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      {/* Back wall's own plinth, closing the loop between the two side lines. */}
      <line
        x1={L}
        y1={H}
        x2={R}
        y2={H}
        stroke="var(--plinth-hi)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={L}
        y1={C}
        x2={R}
        y2={C}
        stroke="var(--joint-color)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Overhead light that answers to the match instead of just existing. Only
 * opacity and color ever change — the camera never moves, which was the
 * whole complaint about the old drifting backdrop.
 */
function RoomLight() {
  const reducedMotion = useEffectiveReducedMotion();
  const [mood, setMood] = useState<"idle" | "active" | "flash" | "warm" | "cold">("idle");
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedMotion)
      return;
    return subscribeAmbient((event) => {
      const next
        = event.cue === "turn_start"
          ? "active"
          : event.cue === "trick"
            ? "flash"
            : event.cue === "win"
              ? "warm"
              : event.cue === "lose" || event.cue === "timeout"
                ? "cold"
                : null;
      if (!next)
        return;
      if (resetRef.current)
        clearTimeout(resetRef.current);
      setMood(next);
      // "active" holds for the whole turn; the rest are momentary accents.
      if (next !== "active")
        resetRef.current = setTimeout(setMood, 900, "idle");
    });
  }, [reducedMotion]);

  useEffect(() => () => {
    if (resetRef.current)
      clearTimeout(resetRef.current);
  }, []);

  const intensity
    = mood === "flash" ? 1 : mood === "active" ? 0.78 : mood === "warm" ? 0.9 : mood === "cold" ? 0.3 : 0.55;
  const color
    = mood === "warm"
      ? "var(--light-warm)"
      : mood === "cold"
        ? "var(--light-cold)"
        : "var(--light-neutral)";

  return (
    <div
      className="absolute inset-x-0 top-0 h-[70%]"
      style={{
        background: `radial-gradient(ellipse 34% 88% at 50% -6%, ${color} 0%, transparent 68%)`,
        opacity: intensity,
        transition: "opacity 520ms ease, background 520ms ease",
      }}
    />
  );
}

/**
 * One mask instead of the six stacked black layers the old backdrop used —
 * those crushed every mid-tone in the room to near-black, which is why the
 * environment looked unchanged no matter what went behind it.
 */
function Vignette() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: [
          "radial-gradient(ellipse 78% 68% at 50% 46%, transparent 0%, rgba(0,0,0,0.28) 74%, rgba(0,0,0,0.62) 100%)",
          "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 14%)",
        ].join(", "),
      }}
    />
  );
}

/** Keeps the outgoing plate mounted for one fade so themes don't hard-cut. */
function useCrossfadedPlate(plate: string) {
  const [previous, setPrevious] = useState<string | null>(null);
  const lastRef = useRef(plate);

  useEffect(() => {
    if (lastRef.current === plate)
      return;
    const outgoing = lastRef.current;
    lastRef.current = plate;

    setPrevious(outgoing);
    const t = setTimeout(setPrevious, THEME_FADE_MS, null);
    return () => clearTimeout(t);
  }, [plate]);

  return previous;
}

/** Warms the browser cache for the active theme's art before it's painted. */
function usePreloadedRoomArt(theme: TableThemeId) {
  useEffect(() => {
    for (const src of [ASSETS.roomBackdrops[theme], ...Object.values(ASSETS.floorTextures)]) {
      const img = new Image();
      img.src = src;
    }
  }, [theme]);
}
