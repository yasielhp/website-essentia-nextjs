"use client";

import { useEffect, useReducer, useCallback } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";

type Booking = {
  id: string;
  service_title: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date: string | null;
  time: string | null;
  duration: string | null;
  status: string | null;
};

const PAGE_SIZE = 20;

const statusBadgeClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-600",
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

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── State ────────────────────────────────────────────────────

type PageState = {
  bookings: Booking[];
  total: number;
  page: number;
  loading: boolean;
};

type PageAction =
  | { type: "LOAD_SUCCESS"; bookings: Booking[]; total: number }
  | { type: "SET_LOADING" }
  | { type: "SET_PAGE"; value: number };

const initialState: PageState = {
  bookings: [],
  total: 0,
  page: 0,
  loading: true,
};

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: true };
    case "LOAD_SUCCESS":
      return {
        ...state,
        loading: false,
        bookings: action.bookings,
        total: action.total,
      };
    case "SET_PAGE":
      return { ...state, page: action.value };
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function BookingsPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { bookings, total, page, loading } = state;
  const { push } = useRouter();

  const fetchBookings = useCallback(async () => {
    dispatch({ type: "SET_LOADING" });

    const { data, count } = await insforge.database
      .from("bookings")
      .select(
        "id, service_title, first_name, last_name, email, phone, date, time, duration, status",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    dispatch({
      type: "LOAD_SUCCESS",
      bookings: (data as Booking[] | null) ?? [],
      total: count ?? 0,
    });
  }, [page]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">Bookings</h1>
          <p className="text-petroleum-400 mt-1 text-sm">
            {total} total booking{total !== 1 ? "s" : ""}
          </p>
        </div>

        <Button
          variant="solid"
          size="md"
          href="/dashboard/bookings/new"
          className="gap-2 self-start"
        >
          <IconPlus />
          Create Booking
        </Button>
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Service
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Client
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Email
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Phone
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
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="bg-sand-100 h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No bookings found.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => push(`/dashboard/bookings/${b.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {b.service_title ?? "—"}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {[b.first_name, b.last_name].filter(Boolean).join(" ") ||
                        "—"}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {b.email ?? "—"}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {b.phone ?? "—"}
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

        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={(p) => dispatch({ type: "SET_PAGE", value: p })}
          loading={loading}
        />
      </div>
    </div>
  );
}
