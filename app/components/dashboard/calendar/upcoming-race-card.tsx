"use client";

import Link from "next/link";
import type { UpcomingRace } from "@/types/calendar";
import { formatUpcomingDate } from "@/utils/dashboard-calendar";

export function UpcomingRaceCard({
  race,
  loading,
}: {
  race: UpcomingRace | null;
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
              d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 22v-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h3 className="text-petroleum-700 text-sm font-semibold">Next Race</h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="bg-sand-100 h-4 animate-pulse rounded" />
          <div className="bg-sand-100 h-3 w-2/3 animate-pulse rounded" />
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
            <p className="text-petroleum-400 text-sm">{race.distance_km} km</p>
          )}
          <Link
            href={`/dashboard/races/${race.id}/edit`}
            className="text-petroleum-600 hover:text-petroleum-700 mt-3 inline-block text-xs font-medium underline-offset-2 hover:underline"
          >
            View race →
          </Link>
        </>
      ) : (
        <p className="text-petroleum-300 text-sm">No upcoming races.</p>
      )}
    </div>
  );
}
