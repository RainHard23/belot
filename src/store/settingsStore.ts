import { create } from "zustand";

export type TableThemeId = "neon" | "sapphire" | "emerald" | "burgundy";

/**
 * How much of the 3D room to draw. `low` drops every `filter: blur()` layer
 * and the table's floor reflection (the two expensive parts) and keeps only
 * flat gradients, so weak GPUs still get a lit room instead of a slideshow.
 */
export type RoomQuality = "auto" | "high" | "medium" | "low";

/**
 * Which environment to draw behind the table. `legacy` is the pre-rebuild
 * flat photo backdrop, kept selectable purely so the two can be compared
 * side by side.
 */
export type RoomStyle = "room3d" | "legacy";

const LEGACY_THEME_KEY = "bilot_table_theme";
const STORAGE_KEY = "bilot_settings_v1";

interface PersistedSettings {
  theme: TableThemeId;
  soundOn: boolean;
  soundVolume: number; // 0..1
  hintsOn: boolean;
  cardSize: "sm" | "md" | "lg";
  leftHanded: boolean;
  reducedMotionOverride: "system" | "on" | "off";
  roomQuality: RoomQuality;
  roomStyle: RoomStyle;
}

const DEFAULTS: PersistedSettings = {
  theme: "neon",
  soundOn: true,
  soundVolume: 0.7,
  hintsOn: true,
  cardSize: "md",
  leftHanded: false,
  reducedMotionOverride: "system",
  roomQuality: "auto",
  roomStyle: "room3d",
};

function loadInitial(): PersistedSettings {
  if (typeof window === "undefined")
    return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      return { ...DEFAULTS, ...parsed };
    }
    // Migrate the old single-key theme setting used before settingsStore existed.
    const legacyTheme = window.localStorage.getItem(LEGACY_THEME_KEY);
    if (legacyTheme) {
      return { ...DEFAULTS, theme: legacyTheme as TableThemeId };
    }
  }
  catch {
    // corrupt storage — fall back to defaults
  }
  return DEFAULTS;
}

function persist(state: PersistedSettings) {
  if (typeof window === "undefined")
    return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.localStorage.removeItem(LEGACY_THEME_KEY);
  }
  catch {
    // storage full/blocked — settings just won't persist this session
  }
}

interface SettingsState extends PersistedSettings {
  setTheme: (theme: TableThemeId) => void;
  setSoundOn: (on: boolean) => void;
  setSoundVolume: (v: number) => void;
  setHintsOn: (on: boolean) => void;
  setCardSize: (s: PersistedSettings["cardSize"]) => void;
  setLeftHanded: (v: boolean) => void;
  setReducedMotionOverride: (v: PersistedSettings["reducedMotionOverride"]) => void;
  setRoomQuality: (v: RoomQuality) => void;
  setRoomStyle: (v: RoomStyle) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadInitial(),
  setTheme: (theme) => {
    set({ theme });
    persist({ ...snapshot(get()), theme });
  },
  setSoundOn: (soundOn) => {
    set({ soundOn });
    persist({ ...snapshot(get()), soundOn });
  },
  setSoundVolume: (soundVolume) => {
    const clamped = Math.max(0, Math.min(1, soundVolume));
    set({ soundVolume: clamped });
    persist({ ...snapshot(get()), soundVolume: clamped });
  },
  setHintsOn: (hintsOn) => {
    set({ hintsOn });
    persist({ ...snapshot(get()), hintsOn });
  },
  setCardSize: (cardSize) => {
    set({ cardSize });
    persist({ ...snapshot(get()), cardSize });
  },
  setLeftHanded: (leftHanded) => {
    set({ leftHanded });
    persist({ ...snapshot(get()), leftHanded });
  },
  setReducedMotionOverride: (reducedMotionOverride) => {
    set({ reducedMotionOverride });
    persist({ ...snapshot(get()), reducedMotionOverride });
  },
  setRoomQuality: (roomQuality) => {
    set({ roomQuality });
    persist({ ...snapshot(get()), roomQuality });
  },
  setRoomStyle: (roomStyle) => {
    set({ roomStyle });
    persist({ ...snapshot(get()), roomStyle });
  },
}));

function snapshot(state: PersistedSettings): PersistedSettings {
  return {
    theme: state.theme,
    soundOn: state.soundOn,
    soundVolume: state.soundVolume,
    hintsOn: state.hintsOn,
    cardSize: state.cardSize,
    leftHanded: state.leftHanded,
    reducedMotionOverride: state.reducedMotionOverride,
    roomQuality: state.roomQuality,
    roomStyle: state.roomStyle,
  };
}

/**
 * Resolves `auto` into a concrete tier. Deliberately conservative: phones and
 * low-core machines get `low` because the room's blur layers are fill-rate
 * bound, and reduced-motion users get `medium` (still lit and layered, just
 * without the animated light).
 */
export function useResolvedRoomQuality(): Exclude<RoomQuality, "auto"> {
  const setting = useSettingsStore(s => s.roomQuality);
  if (setting !== "auto")
    return setting;
  if (typeof window === "undefined")
    return "medium";
  const coarse = window.matchMedia?.("(hover: none)").matches === true;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse || cores <= 4)
    return "low";
  return cores >= 8 ? "high" : "medium";
}

/**
 * True if animations/effects should be minimized, honoring an explicit
 * in-app override over the OS-level `prefers-reduced-motion` media query.
 */
export function useEffectiveReducedMotion() {
  const override = useSettingsStore(s => s.reducedMotionOverride);
  if (override === "on")
    return true;
  if (override === "off")
    return false;
  if (typeof window === "undefined")
    return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
