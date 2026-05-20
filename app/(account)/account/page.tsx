"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";
import { updateNewsletterForUser } from "@/actions/newsletter";

type Booking = {
  id: string;
  service_title: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
};

type SummaryCounts = {
  bookings: number;
  races: number;
  sessions: number;
};

const statusBadgeClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-600 line-through",
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const cls = statusBadgeClasses[s] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {s}
    </span>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-sand-50 border-b">
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} className="px-5 py-4">
          <div className="bg-sand-100 h-4 animate-pulse rounded" />
        </td>
      ))}
    </tr>
  );
}

function SummaryCard({
  label,
  count,
  href,
  loading,
}: {
  label: string;
  count: number;
  href: string;
  loading: boolean;
}) {
  return (
    <Link
      href={href}
      className="group border-sand-200 hover:border-petroleum-300 flex flex-col gap-3 rounded-2xl border bg-white p-5 transition-colors"
    >
      <p className="text-petroleum-400 text-sm">{label}</p>
      {loading ? (
        <div className="bg-sand-100 h-9 w-12 animate-pulse rounded" />
      ) : (
        <p className="font-display text-petroleum-700 text-4xl">{count}</p>
      )}
      <span className="text-petroleum-400 group-hover:text-petroleum-500 text-xs transition-colors">
        View all →
      </span>
    </Link>
  );
}

export default function AccountPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { push } = router;

  const [dataState, setDataState] = useState<{
    counts: SummaryCounts;
    upcomingBookings: Booking[];
    dataLoading: boolean;
    newsletterSubscribed: boolean;
  }>({
    counts: { bookings: 0, races: 0, sessions: 0 },
    upcomingBookings: [],
    dataLoading: true,
    newsletterSubscribed: false,
  });
  const { counts, upcomingBookings, dataLoading, newsletterSubscribed } =
    dataState;
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      push("/sign-in");
      return;
    }

    async function load() {
      if (!user) return;

      const today = new Date().toISOString().slice(0, 10);

      const [
        bookingsCountRes,
        racesCountRes,
        sessionsCountRes,
        upcomingRes,
        profileRes,
      ] = await Promise.all([
        insforge.database
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        insforge.database
          .from("race_registrations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        insforge.database
          .from("education_registrations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        insforge.database
          .from("bookings")
          .select("id, service_title, date, time, status")
          .eq("user_id", user.id)
          .neq("status", "cancelled")
          .gte("date", today)
          .order("date", { ascending: true })
          .limit(5),
        insforge.database
          .from("profiles")
          .select("newsletter_subscribed")
          .eq("id", user.id)
          .single(),
      ]);

      setDataState({
        counts: {
          bookings: (bookingsCountRes as { count: number | null }).count ?? 0,
          races: (racesCountRes as { count: number | null }).count ?? 0,
          sessions: (sessionsCountRes as { count: number | null }).count ?? 0,
        },
        upcomingBookings: (upcomingRes.data as Booking[] | null) ?? [],
        dataLoading: false,
        newsletterSubscribed:
          (profileRes.data as { newsletter_subscribed: boolean } | null)
            ?.newsletter_subscribed ?? false,
      });
    }

    void load();
  }, [user, authLoading, push]);

  if (authLoading) return null;
  if (!user) return null;

  const firstName = user.name?.split(" ")[0];
  const greeting = firstName ? `Welcome back, ${firstName}` : "Welcome back";

  return (
    <div className="bg-sand-50 min-h-dvh pt-30 pb-24 md:pt-50">
      <div className="mx-auto max-w-4xl px-5">
        <div className="mb-10">
          <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
            {greeting}
          </h1>
          <p className="text-petroleum-400 mt-2 text-sm">{user.email}</p>
        </div>

        <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="My Bookings"
            count={counts.bookings}
            href="/account/bookings"
            loading={dataLoading}
          />
          <SummaryCard
            label="My Races"
            count={counts.races}
            href="/account/races"
            loading={dataLoading}
          />
          <SummaryCard
            label="My Sessions"
            count={counts.sessions}
            href="/account/education"
            loading={dataLoading}
          />
        </div>

        <div>
          <h2 className="font-display text-petroleum-700 mb-4 text-2xl">
            Upcoming Appointments
          </h2>

          <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-sand-200 border-b text-left">
                    <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                      Service
                    </th>
                    <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                      Date
                    </th>
                    <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                      Time
                    </th>
                    <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dataLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonRow key={i} cols={4} />
                    ))
                  ) : upcomingBookings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-petroleum-400 px-5 py-10 text-center text-sm"
                      >
                        No upcoming appointments.{" "}
                        <Link
                          href="/booking"
                          className="text-petroleum-700 underline underline-offset-2"
                        >
                          Book a session →
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    upcomingBookings.map((b) => (
                      <tr
                        key={b.id}
                        className="border-sand-50 hover:bg-sand-50 border-b transition-colors last:border-0"
                      >
                        <td className="text-petroleum-700 px-5 py-4 font-medium">
                          {b.service_title ?? "—"}
                        </td>
                        <td className="text-petroleum-500 px-5 py-4">
                          {b.date ?? "—"}
                        </td>
                        <td className="text-petroleum-500 px-5 py-4">
                          {b.time ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={b.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!dataLoading && upcomingBookings.length > 0 && (
            <div className="mt-3 text-right">
              <Link
                href="/account/bookings"
                className="text-petroleum-500 hover:text-petroleum-700 text-sm transition-colors"
              >
                View all bookings →
              </Link>
            </div>
          )}
        </div>

        {/* Newsletter */}
        {!dataLoading && (
          <div className="border-sand-200 mt-12 rounded-2xl border bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-petroleum-700 text-xl">
                  Newsletter
                </h2>
                <p className="text-petroleum-400 text-sm">
                  {newsletterSubscribed
                    ? "You are subscribed to Essentia's newsletter."
                    : "Subscribe to receive protocols, insights, and community updates."}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!user || newsletterLoading) return;
                  setNewsletterLoading(true);
                  const next = !newsletterSubscribed;
                  const result = await updateNewsletterForUser(
                    user.id,
                    user.email,
                    next,
                  );
                  if (result.ok) {
                    setDataState((prev) => ({
                      ...prev,
                      newsletterSubscribed: next,
                    }));
                  }
                  setNewsletterLoading(false);
                }}
                disabled={newsletterLoading}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                  newsletterSubscribed ? "bg-petroleum-500" : "bg-sand-200"
                }`}
                role="switch"
                aria-checked={newsletterSubscribed}
                aria-label="Newsletter subscription"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition duration-200 ${
                    newsletterSubscribed ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
