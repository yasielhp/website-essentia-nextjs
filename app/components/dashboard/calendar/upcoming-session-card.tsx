"use client";

import Link from "next/link";
import type { UpcomingSession } from "@/types/calendar";
import { formatUpcomingDate } from "@/utils/dashboard-calendar";

export function UpcomingSessionCard({
  session,
  loading,
}: {
  session: UpcomingSession | null;
  loading: boolean;
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="bg-petroleum-50 flex size-7 items-center justify-center rounded-lg">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="text-petroleum-600"
          >
            <path
              d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-petroleum-700 text-sm font-semibold">
          Next Session
        </h3>
      </div>

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
          {session.speaker && (
            <p className="text-petroleum-400 text-sm">{session.speaker}</p>
          )}
          {session.location && (
            <p className="text-petroleum-400 text-sm">{session.location}</p>
          )}
          <Link
            href={`/dashboard/education/${session.id}/edit`}
            className="text-petroleum-600 hover:text-petroleum-700 mt-3 inline-block text-xs font-medium underline-offset-2 hover:underline"
          >
            View session →
          </Link>
        </>
      ) : (
        <p className="text-petroleum-300 text-sm">No upcoming sessions.</p>
      )}
    </div>
  );
}
