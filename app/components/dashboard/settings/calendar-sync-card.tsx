"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { syncAllCalendars } from "@/services/calendar.client";

/**
 * One button that puts every missing booking on its calendar.
 *
 * Calendars were connected one at a time and synced one at a time, from the
 * screen that owned each connection, and nothing told an administrator which
 * of them had fallen behind — a booking taken while a token was expired simply
 * never appeared. This walks all of them.
 *
 * Repeating it is free: only bookings whose row carries no `google_event_id`
 * are sent, so a second run finds nothing to do.
 */
export function CalendarSyncCard() {
  const t = useTranslations("dashboard.settings.calendarSync");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    synced?: number;
    calendars?: number;
    failed?: number;
    error?: string;
  } | null>(null);

  async function handleSync() {
    setRunning(true);
    setResult(null);
    try {
      setResult(await syncAllCalendars());
    } catch {
      setResult({ ok: false, error: t("failed") });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {t("title")}
      </h2>
      <p className="text-petroleum-400 mb-4 text-sm leading-relaxed">
        {t("description")}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="solid"
          size="md"
          onClick={() => void handleSync()}
          disabled={running}
        >
          {running ? t("running") : t("action")}
        </Button>

        {result?.ok && (
          <p className="text-petroleum-500 text-sm">
            {t("done", {
              synced: result.synced ?? 0,
              calendars: result.calendars ?? 0,
            })}
            {result.failed
              ? ` · ${t("failedCount", { n: result.failed })}`
              : ""}
          </p>
        )}

        {result && !result.ok && (
          <p role="alert" className="text-sm text-red-600">
            {result.error ?? t("failed")}
          </p>
        )}
      </div>
    </div>
  );
}
