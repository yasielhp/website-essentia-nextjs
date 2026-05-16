"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

type EducationSession = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  duration_minutes: number | null;
  location: string | null;
  max_participants: number | null;
  registrations_count: number;
  is_registered: boolean;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionCard({
  session,
  onRegister,
  onUnregister,
  busy,
}: {
  session: EducationSession;
  onRegister: (id: string) => void;
  onUnregister: (id: string) => void;
  busy: boolean;
}) {
  const isFull =
    session.max_participants != null &&
    session.registrations_count >= session.max_participants &&
    !session.is_registered;

  return (
    <div className="border-sand-200 flex flex-col gap-3 rounded-2xl border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-petroleum-700 text-xl leading-snug">
          {session.title}
        </h3>
        {isFull && (
          <span className="bg-sand-100 text-petroleum-500 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
            Full
          </span>
        )}
        {session.is_registered && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Registered
          </span>
        )}
      </div>

      {session.description && (
        <p className="text-petroleum-400 line-clamp-2 text-sm">
          {session.description}
        </p>
      )}

      <div className="text-petroleum-500 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <span>{formatDateTime(session.date)}</span>
        {session.duration_minutes != null && (
          <span className="bg-petroleum-50 text-petroleum-700 rounded-full px-2.5 py-0.5 text-xs">
            {session.duration_minutes} min
          </span>
        )}
        {session.location && <span>{session.location}</span>}
      </div>

      <div className="mt-1 flex items-center justify-between">
        <p className="text-petroleum-400 text-sm">
          {session.registrations_count}
          {session.max_participants != null
            ? ` / ${session.max_participants}`
            : ""}{" "}
          participants
        </p>

        {session.is_registered ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUnregister(session.id)}
            disabled={busy}
          >
            {busy ? "…" : "Unregister"}
          </Button>
        ) : isFull ? null : (
          <Button
            variant="solid"
            size="sm"
            onClick={() => onRegister(session.id)}
            disabled={busy}
          >
            {busy ? "…" : "Register"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AccountEducationPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { push } = router;

  const [sessions, setSessions] = useState<EducationSession[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (userId: string) => {
    const today = new Date().toISOString().slice(0, 10);

    const [sessionsRes, myRegsRes] = await Promise.all([
      insforge.database
        .from("education_sessions")
        .select(
          "id, title, description, date, duration_minutes, location, max_participants",
        )
        .gte("date", today)
        .order("date", { ascending: true }),
      insforge.database
        .from("education_registrations")
        .select("session_id")
        .eq("user_id", userId),
    ]);

    const sessionList =
      (sessionsRes.data as
        | Omit<EducationSession, "registrations_count" | "is_registered">[]
        | null) ?? [];
    const mySessionIds = new Set(
      ((myRegsRes.data as { session_id: string }[] | null) ?? []).map(
        (r) => r.session_id,
      ),
    );

    if (sessionList.length === 0) {
      setSessions([]);
      setDataLoading(false);
      return;
    }

    const ids = sessionList.map((s) => s.id);
    const { data: regData } = await insforge.database
      .from("education_registrations")
      .select("session_id")
      .in("session_id", ids);

    const countMap: Record<string, number> = {};
    if (regData) {
      for (const row of regData as { session_id: string }[]) {
        countMap[row.session_id] = (countMap[row.session_id] ?? 0) + 1;
      }
    }

    setSessions(
      sessionList.map((s) => ({
        ...s,
        registrations_count: countMap[s.id] ?? 0,
        is_registered: mySessionIds.has(s.id),
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

  async function handleRegister(sessionId: string) {
    if (!user) return;
    setBusyId(sessionId);
    await insforge.database
      .from("education_registrations")
      .insert([{ session_id: sessionId, user_id: user.id }]);
    await load(user.id);
    setBusyId(null);
  }

  async function handleUnregister(sessionId: string) {
    if (!user) return;
    setBusyId(sessionId);
    await insforge.database
      .from("education_registrations")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", user.id);
    await load(user.id);
    setBusyId(null);
  }

  const availableSessions = sessions.filter((s) => !s.is_registered);
  const mySessions = sessions.filter((s) => s.is_registered);

  return (
    <div className="bg-sand-50 min-h-dvh pt-30 pb-24 md:pt-50">
      <div className="mx-auto max-w-4xl px-5">
        <div className="mb-10">
          <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
            Education
          </h1>
          <p className="text-petroleum-400 mt-2 text-sm">
            Upcoming sessions and your registrations
          </p>
        </div>

        {mySessions.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-petroleum-700 mb-5 text-2xl">
              My Sessions
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {mySessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onRegister={() => void handleRegister(session.id)}
                  onUnregister={() => void handleUnregister(session.id)}
                  busy={busyId === session.id}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-petroleum-700 mb-5 text-2xl">
            Upcoming Sessions
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
          ) : availableSessions.length === 0 ? (
            <div className="border-sand-200 rounded-2xl border bg-white p-10 text-center">
              <p className="text-petroleum-400 text-sm">
                {mySessions.length > 0
                  ? "You are registered for all upcoming sessions."
                  : "No upcoming sessions at the moment."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {availableSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onRegister={() => void handleRegister(session.id)}
                  onUnregister={() => void handleUnregister(session.id)}
                  busy={busyId === session.id}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
