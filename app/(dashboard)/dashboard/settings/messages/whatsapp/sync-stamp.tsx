"use client";

import { useFormatter, useTranslations } from "next-intl";
import { syncAge, type SyncAge } from "@/lib/whatsapp/template-ui";

const UNIT_MS = { minute: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

/** Minutes and hours short ("3 min", "2 h"), days in full ("3 days"). */
const UNIT_STYLE = { minute: "short", hour: "short", day: "long" } as const;

/**
 * "Updated 3 min ago": when the copy of the templates was last brought from
 * Meta, said the way a person says it. `now` comes from the caller, who ticks
 * it every minute, so this stays a function of what it is given. The exact
 * date is not lost: `<time datetime>` carries it and the tooltip says it.
 *
 * It depends on the hour of the browser, so it is drawn there; the flag on
 * `<time>` is for the one render where a server-written second could differ.
 * Not a live region: it changes every minute and must not be read out each
 * time.
 */
export function SyncStamp({ at, now }: { at: number; now: number }) {
  const t = useTranslations("dashboard.messages.whatsapp");
  const format = useFormatter();
  const age: SyncAge = syncAge(at, now);
  const text =
    age.kind === "justNow"
      ? t("autoSync.justNow")
      : t("autoSync.updated", {
          // A date exactly `value` units back, so the formatter says exactly that.
          ago: format.relativeTime(now - age.value * UNIT_MS[age.unit], {
            now,
            unit: age.unit,
            style: UNIT_STYLE[age.unit],
          }),
        });
  const exact = t("autoSync.exact", {
    date: format.dateTime(at, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Atlantic/Canary",
    }),
  });
  return (
    <p className="text-petroleum-400 text-xs">
      <time
        dateTime={new Date(at).toISOString()}
        title={exact}
        suppressHydrationWarning
      >
        {text}
      </time>
    </p>
  );
}
