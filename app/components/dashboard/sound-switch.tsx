"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  isSoundEnabled,
  isSoundEnabledOnServer,
  setSoundEnabled,
  subscribeToSoundPreference,
} from "@/lib/feedback";

/**
 * Turns the confirmation cues on and off.
 *
 * The preference lives in `localStorage`, so it is an external store rather
 * than React state; `useSyncExternalStore` reads it without a render-then-
 * correct pass, and the server snapshot matches the engine's own default so
 * the first paint agrees with the markup.
 */
export function SoundSwitch() {
  const t = useTranslations("dashboard.shell");
  const enabled = useSyncExternalStore(
    subscribeToSoundPreference,
    isSoundEnabled,
    isSoundEnabledOnServer,
  );

  return (
    <div className="border-sand-100 flex items-center justify-between border-b px-4 py-2.5">
      <span className="text-petroleum-400 text-xs">{t("sound")}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t("sound")}
        onClick={() => setSoundEnabled(!enabled)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-petroleum-700" : "bg-sand-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
