"use client";

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
      className={`border-sand-200 rounded-2xl border bg-white p-5 transition-colors ${href ? "hover:bg-sand-50 cursor-pointer" : ""}`}
      onClick={() => href && (window.location.href = href)}
    >
      <h3 className="font-display text-petroleum-700 mb-3 text-sm">
        Next Race
      </h3>

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
        </>
      ) : (
        <p className="text-petroleum-300 text-sm">No upcoming races.</p>
      )}
    </div>
  );
}
