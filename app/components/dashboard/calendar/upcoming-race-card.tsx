"use client";

import Image from "next/image";
import type { UpcomingRace } from "@/types/calendar";
import { formatUpcomingDate } from "@/utils/dashboard-calendar";

export function UpcomingRaceCard({
  race,
  loading,
}: {
  race: UpcomingRace | null;
  loading: boolean;
}) {
  const href = race ? `/dashboard/races/${race.id}/edit` : undefined;

  return (
    <div
      className={`border-sand-200 flex items-stretch overflow-hidden rounded-2xl border bg-white transition-colors ${href ? "hover:bg-sand-50 cursor-pointer" : ""}`}
      onClick={() => href && (window.location.href = href)}
    >
      {/* Image panel — shown when loaded with data, or as skeleton */}
      {loading ? (
        <div className="bg-sand-100 w-24 shrink-0 animate-pulse" />
      ) : race ? (
        <div className="bg-sand-100 relative w-24 shrink-0">
          {race.image_url ? (
            <Image
              src={race.image_url}
              alt={race.title}
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
          Next Race
        </h3>

        {loading ? (
          <div className="space-y-2">
            <div className="bg-sand-100 h-4 animate-pulse rounded" />
            <div className="bg-sand-100 h-3 w-2/3 animate-pulse rounded" />
            <div className="bg-sand-100 h-3 w-1/2 animate-pulse rounded" />
          </div>
        ) : race ? (
          <>
            <p className="text-petroleum-700 font-medium">{race.title}</p>
            <p className="text-petroleum-400 mt-1 text-sm">
              {formatUpcomingDate(race.date)}
            </p>
            {race.location && (
              <p className="text-petroleum-400 text-sm">{race.location}</p>
            )}
            {race.distance_km != null && (
              <p className="text-petroleum-400 text-sm">
                {race.distance_km} km
              </p>
            )}
          </>
        ) : (
          <p className="text-petroleum-300 text-sm">No upcoming races.</p>
        )}
      </div>
    </div>
  );
}
