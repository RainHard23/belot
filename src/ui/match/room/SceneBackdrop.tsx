import type { TableThemeId } from "@/store/settingsStore";
import { ASSETS } from "@/ui/assets";

/**
 * Full painted scene (room + table in one plate). Cards/HUD sit on top;
 * `TableSurface` is hidden while this style is active.
 * Parent (`MatchRoom`) is already full-bleed absolute.
 */
export function SceneBackdrop({ theme }: { theme: TableThemeId }) {
  const plate = ASSETS.scenePlates[theme as keyof typeof ASSETS.scenePlates]
    ?? ASSETS.scenePlates.tavern;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "#120c08" }}>
      <div
        key={theme}
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${plate}?v=8)`,
          transform: "scale(1.06)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,transparent_55%,rgba(0,0,0,0.28)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent" />
    </div>
  );
}
