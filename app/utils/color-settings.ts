export const SERVICES = [
  { id: "manual-therapies", label: "Manual Therapies" },
  { id: "facial-therapies", label: "Therapeutic Facials" },
  { id: "contrast-therapy", label: "Contrast Therapy" },
  { id: "breathing-sessions", label: "Breathing Sessions" },
  { id: "red-light-therapy", label: "Red Light Therapy" },
  { id: "hyperbaric-chambers", label: "Hyperbaric Chambers" },
  { id: "intravenous-therapy", label: "Intravenous Therapy" },
  { id: "regenerative-medicine", label: "Regenerative Medicine" },
] as const;

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

const STORAGE_KEY = "essentia:color-settings";

/** Bumped whenever the stored shape changes; see `booking-storage.ts`. */
const SETTINGS_VERSION = 1;

export function loadColorSettings(): ColorSettings {
  if (typeof window === "undefined") return DEFAULT_COLORS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLORS;
    const parsed = JSON.parse(raw) as Partial<ColorSettings> & {
      version?: number;
    };
    // An older shape falls back to the defaults instead of merging halves.
    if (parsed.version !== SETTINGS_VERSION) return DEFAULT_COLORS;
    return {
      services: { ...DEFAULT_COLORS.services, ...(parsed.services ?? {}) },
      races: parsed.races ?? DEFAULT_COLORS.races,
      sessions: parsed.sessions ?? DEFAULT_COLORS.sessions,
    };
  } catch {
    return DEFAULT_COLORS;
  }
}

export function saveColorSettings(settings: ColorSettings): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...settings, version: SETTINGS_VERSION }),
  );
}
