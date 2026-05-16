"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

type RaceAccess = "members" | "open";

type Race = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  distance_km: number | null;
  max_participants: number | null;
  image_url: string | null;
  access: RaceAccess;
  created_at: string | null;
  registrations_count: number;
};

const RACE_ACCESS_LABELS: Record<RaceAccess, string> = {
  members: "Members only",
  open: "Open · free",
};

const RACE_ACCESS_COLORS: Record<RaceAccess, string> = {
  members: "bg-petroleum-50 text-petroleum-600",
  open: "bg-green-50 text-green-700",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function IconPlus() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);

  const { push } = useRouter();

  const fetchRaces = useCallback(async () => {
    setLoading(true);

    const { data: racesData } = await insforge.database
      .from("races")
      .select(
        "id, title, description, date, location, distance_km, max_participants, image_url, access, created_at",
      )
      .order("date", { ascending: false });

    if (!racesData || (racesData as unknown[]).length === 0) {
      setRaces([]);
      setLoading(false);
      return;
    }

    const list = racesData as Omit<Race, "registrations_count">[];
    const ids = list.map((r) => r.id);

    const { data: regData } = await insforge.database
      .from("race_registrations")
      .select("race_id")
      .in("race_id", ids);

    const countMap: Record<string, number> = {};
    if (regData) {
      for (const row of regData as { race_id: string }[]) {
        countMap[row.race_id] = (countMap[row.race_id] ?? 0) + 1;
      }
    }

    setRaces(
      list.map((r) => ({
        ...r,
        registrations_count: countMap[r.id] ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRaces();
  }, [fetchRaces]);

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">Races</h1>
        </div>

        <Button
          variant="solid"
          size="md"
          href="/dashboard/races/new"
          className="gap-2 self-start"
        >
          <IconPlus />
          Create Race
        </Button>
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="w-14 px-4 py-3.5"></th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Title
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Access
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Date
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Location
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Distance
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Registered / Max
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="bg-sand-100 h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : races.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No races yet.
                  </td>
                </tr>
              ) : (
                races.map((race) => (
                  <tr
                    key={race.id}
                    onClick={() => push(`/dashboard/races/${race.id}/edit`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        push(`/dashboard/races/${race.id}/edit`);
                    }}
                    tabIndex={0}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="bg-sand-100 relative size-10 shrink-0 overflow-hidden rounded-lg">
                        {race.image_url ? (
                          <Image
                            src={race.image_url}
                            alt={race.title}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <div className="bg-petroleum-700/10 flex size-full items-center justify-center">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="text-petroleum-400"
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
                    </td>
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {race.title}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RACE_ACCESS_COLORS[race.access]}`}
                      >
                        {RACE_ACCESS_LABELS[race.access]}
                      </span>
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatDate(race.date)}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {race.location ?? "—"}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {race.distance_km != null ? (
                        `${race.distance_km} km`
                      ) : (
                        <span className="text-petroleum-400">{"—"}</span>
                      )}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      <span
                        className={
                          race.max_participants != null &&
                          race.registrations_count >= race.max_participants
                            ? "font-medium text-red-500"
                            : ""
                        }
                      >
                        {race.registrations_count}
                      </span>
                      {race.max_participants != null ? (
                        <span className="text-petroleum-400">
                          {" "}
                          / {race.max_participants}
                        </span>
                      ) : (
                        <span className="text-petroleum-400">{" / —"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
