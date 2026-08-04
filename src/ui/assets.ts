/** Central asset paths — all UI loads from here */

export const ASSETS = {
  avatarDefault: "/assets/avatars/player.png",
  logo: "/assets/nav/logo.svg",
  flagEn: "/assets/nav/flag-en.svg",
  navBelote: "/assets/nav/belote.png",
  chipRed: "/assets/chips/chip-red.svg",
  chipGold: "/assets/chips/chip-gold.svg",
  chipTeal: "/assets/chips/chip-teal.svg",
  lobbyRef: "/assets/figma/lobby-ref.png",
} as const;

export function avatarUrl(name: string, seed?: string): string {
  const s = encodeURIComponent(seed ?? name);
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${s}&backgroundColor=1d1d22`;
}
