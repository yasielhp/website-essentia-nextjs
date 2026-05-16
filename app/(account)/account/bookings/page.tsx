"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";

type Booking = {
  id: string;
  service_title: string | null;
  date: string | null;
  time: string | null;
  duration: string | null;
  status: string | null;
};

const statusBadgeClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-600",
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const cls = statusBadgeClasses[s] ?? "bg-sand-100 text-petroleum-500";
  const strikethrough = s === "cancelled" ? "line-through" : "";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls} ${strikethrough}`}
    >
      {s}
    </span>
  );
}

export default function AccountBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { push } = router;

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      push("/sign-in");
      return;
    }

    async function load() {
      if (!user) return;

      const { data } = await insforge.database
        .from("bookings")
        .select("id, service_title, date, time, duration, status")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      setBookings((data as Booking[] | null) ?? []);
      setDataLoading(false);
    }

    void load();
  }, [user, authLoading, push]);

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="bg-sand-50 min-h-dvh pt-30 pb-24 md:pt-50">
      <div className="mx-auto max-w-4xl px-5">
        <div className="mb-10">
          <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
            My Bookings
          </h1>
          {!dataLoading && (
            <p className="text-petroleum-400 mt-2 text-sm">
              {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
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
                    Duration
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {dataLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-sand-50 border-b">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="bg-sand-100 h-4 animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : bookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-petroleum-400 px-5 py-12 text-center"
                    >
                      No bookings yet.{" "}
                      <Link
                        href="/booking"
                        className="text-petroleum-700 underline underline-offset-2"
                      >
                        Book your first session →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
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
                      <td className="text-petroleum-400 px-5 py-4">
                        {b.duration ?? "—"}
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
      </div>
    </div>
  );
}
