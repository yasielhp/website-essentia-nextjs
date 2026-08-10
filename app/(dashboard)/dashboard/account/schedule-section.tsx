"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { updateOwnSchedule } from "@/actions/update-own-schedule";
import { StaffScheduleEditor } from "@/components/dashboard/users/staff-schedule-editor";
import { normaliseSchedule } from "@/utils/staff-schedule";
import { Button } from "@/components/ui/button";
import type { WeeklySchedule } from "@/types/schedule";

/**
 * The days and hours this professional works, on their own account page.
 *
 * It used to live only on the admin's screen for editing somebody else, so a
 * member of staff could not so much as read their own week — they had to ask.
 *
 * What is set here is what the public is offered: the working day bounds the
 * starts, and the interval is the spacing between them. A 15-minute interval on
 * a 10:00–13:00 Wednesday is nine possible starts for an hour-long session, not
 * three.
 */
export function ScheduleSection({ userId }: { userId: string }) {
  const t = useTranslations("dashboard.account.schedule");
  const [schedule, setSchedule] = useState<WeeklySchedule>(() =>
    normaliseSchedule(null),
  );
  const [interval, setInterval] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await insforge.database
        .from("profiles")
        .select("schedule, slot_interval_minutes")
        .eq("id", userId)
        .limit(1);

      if (cancelled) return;

      const row = (
        data as
          | {
              schedule: WeeklySchedule | null;
              slot_interval_minutes: number | null;
            }[]
          | null
      )?.[0];

      setSchedule(normaliseSchedule(row?.schedule ?? null));
      setInterval(row?.slot_interval_minutes ?? 30);
      setLoading(false);
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await updateOwnSchedule(getAccessToken(), {
        schedule,
        slotIntervalMinutes: interval,
      });

      if (saveError) {
        setError(saveError);
        return;
      }
      notifySuccess(t("saved"));
    } finally {
      // In `finally`, not after the await: the action answers with an `error`
      // rather than throwing, but the call itself still can — a dropped
      // connection, a session that expired mid-request — and a reset that only
      // runs on the happy path leaves the button disabled with no way back.
      setSaving(false);
    }
  }

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {t("heading")}
      </h2>
      <p className="text-petroleum-400 mb-4 text-xs">{t("hint")}</p>

      {error && (
        <p className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="bg-sand-100 h-64 animate-pulse rounded-xl" />
      ) : (
        <>
          <StaffScheduleEditor
            schedule={schedule}
            interval={interval}
            onChange={setSchedule}
            onIntervalChange={setInterval}
            disabled={saving}
          />
          <Button
            type="button"
            variant="solid"
            size="md"
            disabled={saving}
            onClick={() => void handleSave()}
            className="mt-4"
          >
            {saving ? t("saving") : t("save")}
          </Button>
        </>
      )}
    </div>
  );
}
