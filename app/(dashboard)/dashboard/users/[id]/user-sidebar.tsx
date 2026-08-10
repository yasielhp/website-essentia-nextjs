"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { ImageUpload } from "@/components/ui/image-upload";
import { IconCalendarConnect } from "@/components/ui/icons";
import {
  connectAccountCalendar,
  disconnectAccountCalendar,
  resyncAccountCalendar,
} from "@/services/calendar.client";

/**
 * The column beside the form: their photo, and their Google Calendar.
 *
 * Neither belongs to the profile the form saves — the photo writes straight to
 * the bucket, the calendar to their own OAuth tokens — so the page passed them
 * through only to render them here.
 */
export function UserSidebar({
  userId,
  role,
  loading,
  avatarUrl,
  onAvatarChange,
  calendarEmail,
  onDisconnected,
}: {
  userId: string;
  role: string;
  loading: boolean;
  avatarUrl: string | null;
  onAvatarChange: (value: string) => void;
  /** The Google account they connected, or null if none. */
  calendarEmail: string | null;
  onDisconnected: () => void;
}) {
  const t = useTranslations("dashboard.users.form");
  const tCalendar = useTranslations("dashboard.settings.calendar");
  const [resyncing, setResyncing] = useState(false);

  return (
    <div className="flex flex-col gap-6 lg:sticky lg:top-24">
      {/* Photo — every role has one, same bucket the account page uses */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("sections.photo")}
        </h2>
        {loading ? (
          <div className="bg-sand-100 h-36 animate-pulse rounded-xl" />
        ) : (
          <ImageUpload
            bucket="events"
            folder="staff"
            value={avatarUrl}
            onChange={onAvatarChange}
          />
        )}
      </div>

      {/* Google Calendar — theirs, checked when offering slots */}
      {/* Staff connect a calendar so their bookings appear on it and
        their busy hours narrow what the public can book. An admin
        connects one to mirror the whole centre's diary — nothing they
        have on it ever hides a slot from a client. */}
      {!loading && (role === "staff" || role === "admin") && (
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
            {t("calendar.label")}
          </h2>
          <p className="text-petroleum-400 mb-4 text-xs">
            {role === "admin" ? t("calendar.adminHint") : tCalendar("hint")}
          </p>
          {calendarEmail && (
            <p className="text-petroleum-400 mb-3 truncate text-xs">
              {calendarEmail}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {calendarEmail ? (
              <>
                {/* Bookings made while the calendar was disconnected —
                  or whose sync failed — have no event yet. */}
                <button
                  type="button"
                  disabled={resyncing}
                  onClick={async () => {
                    setResyncing(true);
                    const result = await resyncAccountCalendar(userId);
                    setResyncing(false);
                    notifySuccess(
                      result
                        ? tCalendar("resynced", {
                            synced: result.synced,
                            failed: result.failed,
                          })
                        : tCalendar("resyncFailed"),
                    );
                  }}
                  className="border-sand-200 text-petroleum-700 hover:bg-sand-50 w-full rounded-xl border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {resyncing ? tCalendar("resyncing") : tCalendar("resync")}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await disconnectAccountCalendar(userId);
                    onDisconnected();
                  }}
                  className="w-full rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  {tCalendar("disconnect")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void connectAccountCalendar(
                    userId,
                    `/dashboard/users/${userId}`,
                  )
                }
                className="bg-petroleum-700 hover:bg-petroleum-600 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white transition-colors"
              >
                <IconCalendarConnect />
                {tCalendar("connect")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
