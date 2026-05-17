export const SERVICES = [
  { id: "contrast-therapy", label: "Contrast Therapy" },
  { id: "breathing-sessions", label: "Breathing Sessions" },
  { id: "red-light-therapy", label: "Red Light Therapy" },
  { id: "manual-therapies", label: "Manual Therapies" },
  { id: "functional-well-being", label: "Functional Well-being" },
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
    "functional-well-being": "#16a34a",
    "hyperbaric-chambers": "#0891b2",
    "intravenous-therapy": "#9333ea",
    "regenerative-medicine": "#059669",
  },
  races: "#1d4ed8",
  sessions: "#0369a1",
};

const STORAGE_KEY = "essentia:color-settings";

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

export function saveColorSettings(settings: ColorSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetColorSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}
