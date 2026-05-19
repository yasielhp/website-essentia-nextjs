"use client";

import Image from "next/image";
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
      className={`border-sand-200 flex items-stretch overflow-hidden rounded-2xl border bg-white transition-colors ${href ? "hover:bg-sand-50 cursor-pointer" : ""}`}
      onClick={() => href && (window.location.href = href)}
    >
      {/* Image panel — shown when loaded with data, or as skeleton */}
      {loading ? (
        <div className="bg-sand-100 w-24 shrink-0 animate-pulse" />
      ) : session ? (
        <div className="bg-sand-100 relative w-24 shrink-0">
          {session.image_url ? (
            <Image
              src={session.image_url}
              alt={session.title}
              fill
              className="object-cover"
              sizes="96px"
            />
          ) : (
            <div className="bg-petroleum-700/10 flex size-full items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="text-petroleum-300"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle
                  cx="8.5"
                  cy="8.5"
                  r="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M21 15l-5-5L5 21"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>
      ) : null}

      <div className="flex-1 p-5">
        <h3 className="text-petroleum-700 mb-3 text-sm font-semibold">
          Next Session
        </h3>

        {loading ? (
          <div className="space-y-2">
            <div className="bg-sand-100 h-4 animate-pulse rounded" />
            <div className="bg-sand-100 h-3 w-2/3 animate-pulse rounded" />
            <div className="bg-sand-100 h-3 w-1/2 animate-pulse rounded" />
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
    </div>
  );
}
