import type { TableThemeId } from "@/store/settingsStore";
import { ASSETS } from "@/ui/assets";

/**
 * The environment as it was before `RoomStage` replaced it: one photographic
 * plate stretched full-bleed under six darkening layers.
 *
 * Kept only so the old and the new room can be switched between and compared
 * (second swatch row in the settings popover). Deliberately frozen — the tint
 * and ray colors are inlined here instead of reading `--room-*` tokens,
 * because those tokens now serve the 3D room and have different values; a
 * comparison against a moving target is worthless. Nothing else should import
 * this, and it can be deleted outright once the comparison is settled.
 */
const LEGACY_TINTS: Record<TableThemeId, { c1: string; c2: string; c3: string; rays: string; raysOpacity: number }> = {
  emerald: { c1: "#2a2a34", c2: "#151518", c3: "#0a0a0c", rays: "transparent", raysOpacity: 0 },
  neon: { c1: "#1a3a80", c2: "#0a1535", c3: "#020610", rays: "#35e6ff", raysOpacity: 0.12 },
  sapphire: { c1: "#1a3550", c2: "#101c30", c3: "#060a14", rays: "#8fc4ff", raysOpacity: 0.06 },
  burgundy: { c1: "#3a1c20", c2: "#1c0e10", c3: "#0a0505", rays: "#ff9d6e", raysOpacity: 0.05 },
  tavern: { c1: "#3a2a18", c2: "#1a120a", c3: "#080603", rays: "#ffc070", raysOpacity: 0.06 },
};

export function LegacyBackdrop({ theme }: { theme: TableThemeId }) {
  const bg = ASSETS.roomBackdrops[theme] ?? ASSETS.roomBackdrops.neon;
  const tint = LEGACY_TINTS[theme] ?? LEGACY_TINTS.neon;
  return (
    <>
      <div
        key={theme}
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(2,6,15,0.72) 0%, rgba(2,6,15,0.35) 42%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          background: `radial-gradient(ellipse at 50% 35%, ${tint.c1} 0%, ${tint.c2} 45%, ${tint.c3} 100%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/25" />
      <div
        className="pointer-events-none absolute inset-0 blur-[2px] mix-blend-screen"
        style={{
          background: `repeating-conic-gradient(from 0deg at 50% 38%, ${tint.rays} 0deg 1.1deg, transparent 1.1deg 13deg)`,
          opacity: tint.raysOpacity,
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/75 to-transparent" />
    </>
  );
}
