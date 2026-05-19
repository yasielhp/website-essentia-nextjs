"use client";

import type { UpcomingSession } from "@/types/calendar";
import { formatUpcomingDate } from "@/utils/dashboard-calendar";

export function UpcomingSessionCard({
  session,
  loading,
}: {
  session: UpcomingSession | null;
  loading: boolean;
}) {
  const href = session ? `/dashboard/education/${session.id}/edit` : undefined;

  return (
    <div
      className={`border-sand-200 rounded-2xl border bg-white p-5 transition-colors ${href ? "hover:bg-sand-50 cursor-pointer" : ""}`}
      onClick={() => href && (window.location.href = href)}
    >
      <h3 className="font-display text-petroleum-700 mb-3 text-sm">
        Next Session
      </h3>

      {loading ? (
        <div className="space-y-2">
          <div className="bg-sand-100 h-4 animate-pulse rounded" />
          <div className="bg-sand-100 h-3 w-2/3 animate-pulse rounded" />
        </div>
      ) : session ? (
        <>
          <p className="text-petroleum-700 font-medium">{session.title}</p>
          <p className="text-petroleum-400 mt-1 text-sm">
            {formatUpcomingDate(session.date)}
            {session.duration_minutes != null &&
              ` · ${session.duration_minutes} min`}
          </p>
          {session.location && (
            <p className="text-petroleum-400 text-sm">{session.location}</p>
          )}
        </>
      ) : (
        <p className="text-petroleum-300 text-sm">No upcoming sessions.</p>
      )}
    </div>
  );
}
