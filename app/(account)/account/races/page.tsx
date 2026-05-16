"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

type Race = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  distance_km: number | null;
  max_participants: number | null;
  registrations_count: number;
  is_registered: boolean;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function RaceCard({
  race,
  onRegister,
  onUnregister,
  busy,
}: {
  race: Race;
  onRegister: (id: string) => void;
  onUnregister: (id: string) => void;
  busy: boolean;
}) {
  const isFull =
    race.max_participants != null &&
    race.registrations_count >= race.max_participants &&
    !race.is_registered;

  return (
    <div className="border-sand-200 flex flex-col gap-3 rounded-2xl border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-petroleum-700 text-xl leading-snug">
          {race.title}
        </h3>
        {isFull && (
          <span className="bg-sand-100 text-petroleum-500 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Full
          </span>
        )}
        {race.is_registered && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Registered
          </span>
        )}
      </div>

      {race.description && (
        <p className="text-petroleum-400 line-clamp-2 text-sm">
          {race.description}
        </p>
      )}

      <div className="text-petroleum-500 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span>{formatDate(race.date)}</span>
        {race.location && <span>{race.location}</span>}
        {race.distance_km != null && (
          <span className="bg-petroleum-50 text-petroleum-700 rounded-full px-2.5 py-0.5 text-xs">
            {race.distance_km} km
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <p className="text-petroleum-400 text-sm">
          {race.registrations_count}
          {race.max_participants != null
            ? ` / ${race.max_participants}`
            : ""}{" "}
          participants
        </p>

        {race.is_registered ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUnregister(race.id)}
            disabled={busy}
          >
            {busy ? "…" : "Unregister"}
          </Button>
        ) : isFull ? null : (
          <Button
            variant="solid"
            size="sm"
            onClick={() => onRegister(race.id)}
            disabled={busy}
          >
            {busy ? "…" : "Register"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AccountRacesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { push } = router;

  const [races, setRaces] = useState<Race[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (userId: string) => {
    const today = new Date().toISOString().slice(0, 10);

    const [racesRes, myRegsRes] = await Promise.all([
      insforge.database
        .from("races")
        .select(
          "id, title, description, date, location, distance_km, max_participants",
        )
        .gte("date", today)
        .order("date", { ascending: true }),
      insforge.database
        .from("race_registrations")
        .select("race_id")
        .eq("user_id", userId),
    ]);

    const raceList =
      (racesRes.data as
        | Omit<Race, "registrations_count" | "is_registered">[]
        | null) ?? [];
    const myRaceIds = new Set(
      ((myRegsRes.data as { race_id: string }[] | null) ?? []).map(
        (r) => r.race_id,
      ),
    );

    if (raceList.length === 0) {
      setRaces([]);
      setDataLoading(false);
      return;
    }

    const ids = raceList.map((r) => r.id);
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
      raceList.map((r) => ({
        ...r,
        registrations_count: countMap[r.id] ?? 0,
        is_registered: myRaceIds.has(r.id),
      })),
    );
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      push("/sign-in");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(user.id);
  }, [user, authLoading, push, load]);

  if (authLoading) return null;
  if (!user) return null;

  async function handleRegister(raceId: string) {
    if (!user) return;
    setBusyId(raceId);
    await insforge.database
      .from("race_registrations")
      .insert([{ race_id: raceId, user_id: user.id }]);
    await load(user.id);
    setBusyId(null);
  }

  async function handleUnregister(raceId: string) {
    if (!user) return;
    setBusyId(raceId);
    await insforge.database
      .from("race_registrations")
      .delete()
      .eq("race_id", raceId)
      .eq("user_id", user.id);
    await load(user.id);
    setBusyId(null);
  }

  const upcomingRaces = races.filter((r) => !r.is_registered);
  const myRaces = races.filter((r) => r.is_registered);

  return (
    <div className="bg-sand-50 min-h-dvh pt-30 pb-24 md:pt-50">
      <div className="mx-auto max-w-4xl px-5">
        <div className="mb-10">
          <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
            Races
          </h1>
          <p className="text-petroleum-400 mt-2 text-sm">
            Upcoming races and your registrations
          </p>
        </div>

        {myRaces.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-petroleum-700 mb-5 text-2xl">
              My Registrations
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {myRaces.map((race) => (
                <RaceCard
                  key={race.id}
                  race={race}
                  onRegister={() => void handleRegister(race.id)}
                  onUnregister={() => void handleUnregister(race.id)}
                  busy={busyId === race.id}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-petroleum-700 mb-5 text-2xl">
            Upcoming Races
          </h2>

          {dataLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="border-sand-200 space-y-3 rounded-2xl border bg-white p-5"
                >
                  <div className="bg-sand-100 h-6 w-3/4 animate-pulse rounded" />
                  <div className="bg-sand-100 h-4 w-1/2 animate-pulse rounded" />
                  <div className="bg-sand-100 h-4 w-1/3 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : upcomingRaces.length === 0 && !dataLoading ? (
            <div className="border-sand-200 rounded-2xl border bg-white p-10 text-center">
              <p className="text-petroleum-400 text-sm">
                {myRaces.length > 0
                  ? "You are registered for all upcoming races."
                  : "No upcoming races at the moment."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {upcomingRaces.map((race) => (
                <RaceCard
                  key={race.id}
                  race={race}
                  onRegister={() => void handleRegister(race.id)}
                  onUnregister={() => void handleUnregister(race.id)}
                  busy={busyId === race.id}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
