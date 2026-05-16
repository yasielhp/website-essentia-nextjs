"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

type AccessType = "members_only" | "open" | "paid" | "paid_members_free";

type Session = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  duration_minutes: number | null;
  location: string | null;
  max_participants: number | null;
  image_url: string | null;
  access: AccessType;
  registrations_count: number;
};

const ACCESS_LABELS: Record<AccessType, string> = {
  members_only: "Members only",
  open: "Open · free",
  paid: "Paid",
  paid_members_free: "Paid · free for members",
};

const ACCESS_COLORS: Record<AccessType, string> = {
  members_only: "bg-petroleum-50 text-petroleum-600",
  open: "bg-green-50 text-green-700",
  paid: "bg-amber-50 text-amber-700",
  paid_members_free: "bg-blue-50 text-blue-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
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

export default function EducationPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const { push } = useRouter();

  const fetchSessions = useCallback(async () => {
    setLoading(true);

    const { data: rows } = await insforge.database
      .from("education_sessions")
      .select(
        "id, title, description, date, duration_minutes, location, max_participants, image_url, access",
      )
      .order("date", { ascending: false });

    if (!rows || (rows as unknown[]).length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const sessionList = rows as Omit<Session, "registrations_count">[];
    const ids = sessionList.map((s) => s.id);

    const { data: regs } = await insforge.database
      .from("education_registrations")
      .select("session_id")
      .in("session_id", ids);

    const countMap: Record<string, number> = {};
    if (regs) {
      for (const r of regs as { session_id: string }[]) {
        countMap[r.session_id] = (countMap[r.session_id] ?? 0) + 1;
      }
    }

    setSessions(
      sessionList.map((s) => ({
        ...s,
        registrations_count: countMap[s.id] ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">
            Education
          </h1>
        </div>

        <Button
          variant="solid"
          size="md"
          href="/dashboard/education/new"
          className="gap-2 self-start"
        >
          <IconPlus />
          Create Session
        </Button>
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 w-14 px-5 py-3.5 font-medium"></th>
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
                  Time
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Duration
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Location
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Enrolled / Max
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="bg-sand-100 h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No sessions yet.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() =>
                      push(`/dashboard/education/${session.id}/edit`)
                    }
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-5 py-3">
                      {session.image_url ? (
                        <div className="bg-sand-100 relative size-10 overflow-hidden rounded-lg">
                          <Image
                            src={session.image_url}
                            alt={session.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="bg-sand-100 flex size-10 items-center justify-center rounded-lg">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-petroleum-300"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
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
                    </td>
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {session.title}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCESS_COLORS[session.access]}`}
                      >
                        {ACCESS_LABELS[session.access]}
                      </span>
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatDate(session.date)}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatTime(session.date)}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {session.duration_minutes != null
                        ? `${session.duration_minutes} min`
                        : "—"}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {session.location ?? "—"}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {session.registrations_count}
                      {session.max_participants != null
                        ? ` / ${session.max_participants}`
                        : " / —"}
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
