"use client";

import { toast } from "sonner";
import { play, setEnabled } from "cuelume";

/**
 * The dashboard's confirmation feedback: a toast, and a short synthesized cue
 * to go with it.
 *
 * Staff work through these screens in runs — a dozen bookings confirmed in a
 * row — and the only sign anything happened used to be a form that stopped
 * being disabled. A toast says what happened; the sound says it landed without
 * asking anyone to look away from the next row.
 *
 * Cuelume synthesizes each cue through the Web Audio API rather than fetching
 * a file, so this costs no request and nothing to preload. Every cue here
 * follows a click of the user's own, which is what keeps the browser's autoplay
 * policy satisfied.
 */

const SOUND_PREFERENCE_KEY = "essentia.dashboard.sound";

/**
 * The preference is an external store — it lives in `localStorage`, which React
 * does not own — so the switch reads it through `useSyncExternalStore` rather
 * than copying it into state inside an effect.
 */
const listeners = new Set<() => void>();

export function subscribeToSoundPreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sound is on unless the person turned it off. */
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "off";
}

/** What the server renders: the same default the engine starts from. */
export function isSoundEnabledOnServer(): boolean {
  return true;
}

/** Persists the preference and applies it to the audio engine immediately. */
export function setSoundEnabled(enabled: boolean): void {
  setEnabled(enabled);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? "on" : "off");
  }
  for (const listener of listeners) listener();
}

/** Reads the stored preference into the engine. Call once, on mount. */
export function syncSoundPreference(): void {
  setEnabled(isSoundEnabled());
}

export function notifySuccess(message: string): void {
  play("success");
  toast.success(message);
}

export function notifyError(message: string): void {
  play("error");
  toast.error(message);
}
