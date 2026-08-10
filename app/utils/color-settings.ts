export type ColorSettings = {
  services: Record<string, string>;
  races: string;
  sessions: string;
};

export const DEFAULT_COLORS: ColorSettings = {
  services: {
    "contrast-therapy": "#0284c7",
    "breathing-sessions": "#7c3aed",
    "red-light-therapy": "#dc2626",
    "manual-therapies": "#d97706",
    "facial-therapies": "#16a34a",
    "hyperbaric-chambers": "#0891b2",
    "intravenous-therapy": "#9333ea",
    "regenerative-medicine": "#059669",
  },
  races: "#1d4ed8",
  sessions: "#0369a1",
};

/** Bump the `:v1` when the stored shape changes; see `booking-storage.ts`. */
const STORAGE_KEY = "essentia:color-settings:v1";

export function loadColorSettings(): ColorSettings {
  if (typeof window === "undefined") return DEFAULT_COLORS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLORS;
    const parsed = JSON.parse(raw) as Partial<ColorSettings>;
    return {
      services: { ...DEFAULT_COLORS.services, ...(parsed.services ?? {}) },
      races: parsed.races ?? DEFAULT_COLORS.races,
      sessions: parsed.sessions ?? DEFAULT_COLORS.sessions,
    };
  } catch {
    return DEFAULT_COLORS;
  }
}
