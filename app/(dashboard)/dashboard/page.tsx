"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";

type Role = "admin" | "staff" | null;

type StatData = {
  totalBookings: number;
  pendingBookings: number;
  totalStaff: number;
  upcomingRaces: number;
};

type RecentBooking = {
  id: string;
  service_title: string | null;
  first_name: string | null;
  last_name: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-600",
};

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <p className="text-petroleum-400 text-sm">{label}</p>
      {loading ? (
        <div className="bg-sand-100 mt-2 h-8 w-16 animate-pulse rounded-lg" />
      ) : (
        <p className="font-display text-petroleum-700 mt-1 text-3xl">{value}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const cls = statusColors[s] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {s}
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role>(null);
  const [stats, setStats] = useState<StatData>({
    totalBookings: 0,
    pendingBookings: 0,
    totalStaff: 0,
    upcomingRaces: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      if (!user) return;

      const [
        profileRes,
        allBookingsRes,
        pendingRes,
        staffRes,
        racesRes,
        recentRes,
      ] = await Promise.all([
        insforge.database
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single(),
        insforge.database
          .from("bookings")
          .select("id", { count: "exact", head: true }),
        insforge.database
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        insforge.database
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "staff"),
        insforge.database
          .from("races")
          .select("id", { count: "exact", head: true })
          .gte("date", new Date().toISOString().slice(0, 10)),
        insforge.database
          .from("bookings")
          .select(
            "id, service_title, first_name, last_name, date, time, status",
          )
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setRole((profileRes.data as { role: Role } | null)?.role ?? null);
      setStats({
        totalBookings: (allBookingsRes as { count: number | null }).count ?? 0,
        pendingBookings: (pendingRes as { count: number | null }).count ?? 0,
        totalStaff: (staffRes as { count: number | null }).count ?? 0,
        upcomingRaces: (racesRes as { count: number | null }).count ?? 0,
      });
      setRecentBookings((recentRes.data as RecentBooking[] | null) ?? []);
      setLoading(false);
    }

    void load();
  }, [user]);

  const subtitle =
    role === "admin"
      ? "Full access — all data visible"
      : role === "staff"
        ? "Staff view — your assigned data"
        : "";

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1 className="font-display text-petroleum-700 text-3xl">Dashboard</h1>
        {subtitle && (
          <p className="text-petroleum-400 mt-1 text-sm">{subtitle}</p>
        )}
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Bookings"
          value={stats.totalBookings}
          loading={loading}
        />
        <StatCard
          label="Pending Bookings"
          value={stats.pendingBookings}
          loading={loading}
        />
        <StatCard
          label="Total Staff"
          value={stats.totalStaff}
          loading={loading}
        />
        <StatCard
          label="Upcoming Races"
          value={stats.upcomingRaces}
          loading={loading}
        />
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white">
        <div className="border-sand-200 border-b px-6 py-4">
          <h2 className="text-petroleum-700 text-base font-medium">
            Recent Bookings
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                <th className="text-petroleum-400 px-6 py-3 font-medium">
                  Service
                </th>
                <th className="text-petroleum-400 px-6 py-3 font-medium">
                  Client
                </th>
                <th className="text-petroleum-400 px-6 py-3 font-medium">
                  Date
                </th>
                <th className="text-petroleum-400 px-6 py-3 font-medium">
                  Time
                </th>
                <th className="text-petroleum-400 px-6 py-3 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="bg-sand-100 h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : recentBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-petroleum-400 px-6 py-10 text-center"
                  >
                    No bookings yet.
                  </td>
                </tr>
              ) : (
                recentBookings.map((b) => (
                  <tr
                    key={b.id}
                    className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
                  >
                    <td className="text-petroleum-700 px-6 py-4">
                      {b.service_title ?? "—"}
                    </td>
                    <td className="text-petroleum-500 px-6 py-4">
                      {[b.first_name, b.last_name].filter(Boolean).join(" ") ||
                        "—"}
                    </td>
                    <td className="text-petroleum-500 px-6 py-4">
                      {b.date ?? "—"}
                    </td>
                    <td className="text-petroleum-500 px-6 py-4">
                      {b.time ?? "—"}
                    </td>
                    <td className="px-6 py-4">
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
  );
}
