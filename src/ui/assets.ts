/** Central asset paths — all UI loads from here */

export const ASSETS = {
  /**
   * One photographic room per table theme. No longer stretched full-bleed:
   * `RoomStage` crops these to the back wall panel, where the actual wall
   * detail (panelling, sconces, the sapphire skyline) lives.
   */
  roomBackdrops: {
    emerald: "/images/room-backdrop-emerald.jpg",
    sapphire: "/images/room-backdrop-sapphire.jpg",
    burgundy: "/images/room-backdrop-burgundy.jpg",
    neon: "/images/room-backdrop-neon.jpg",
    tavern: "/images/room-backdrop-tavern.png",
  },
  /**
   * Full top-down scenes (room + table). Used by `roomStyle: "scene"`;
   * `TableSurface` is hidden so cards sit on the painted oval.
   */
  scenePlates: {
    tavern: "/images/scene-tavern.png",
  },
  /**
   * Seamless floor materials (CC0, Poly Haven — herringbone_parquet,
   * marble_01, dirty_carpet), downscaled to 512px WebP. Tiled onto the
   * room's 3D floor plane, so perspective does the foreshortening and there
   * is nothing to upscale at any resolution. Themes pick one via
   * `--floor-tex` and tint it with `--floor-tint`.
   */
  floorTextures: {
    parquet: "/textures/parquet.webp",
    marble: "/textures/marble.webp",
    carpet: "/textures/carpet.webp",
  },
  avatarDefault: "/assets/avatars/player.png",
  logo: "/assets/nav/logo.svg",
  flagEn: "/assets/nav/flag-en.svg",
  navBelote: "/assets/nav/belote.png",
  chipRed: "/assets/chips/chip-red.svg",
  chipGold: "/assets/chips/chip-gold.svg",
  chipTeal: "/assets/chips/chip-teal.svg",
  lobby: {
    eye: "/assets/lobby/icon-eye.svg",
    eyeOff: "/assets/lobby/icon-eye-off.svg",
    eyeGold: "/assets/lobby/icon-eye-gold.svg",
    clock: "/assets/lobby/icon-clock.svg",
    players: "/assets/lobby/icon-players.svg",
    tables: "/assets/lobby/icon-tables.svg",
    tournaments: "/assets/lobby/icon-tournaments.svg",
    signal: "/assets/lobby/icon-signal.svg",
    chat: "/assets/lobby/icon-chat.svg",
    trophy: "/assets/lobby/icon-trophy.svg",
  },
} as const;

export function avatarUrl(name: string, seed?: string): string {
  const s = encodeURIComponent(seed ?? name);
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${s}&backgroundColor=1d1d22`;
}
