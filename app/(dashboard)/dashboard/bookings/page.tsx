"use client";

import { useEffect, useReducer, useCallback } from "react";
import { insforge } from "@/lib/insforge";

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

type StatusFilter = "all" | "pending" | "confirmed" | "cancelled";

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

// ─── State ────────────────────────────────────────────────────

type PageState = {
  bookings: Booking[];
  total: number;
  page: number;
  statusFilter: StatusFilter;
  loading: boolean;
};

type PageAction =
  | {
      type: "LOAD_SUCCESS";
      bookings: Booking[];
      total: number;
    }
  | { type: "SET_LOADING" }
  | { type: "SET_STATUS_FILTER"; value: StatusFilter }
  | { type: "SET_PAGE"; value: number };

const initialState: PageState = {
  bookings: [],
  total: 0,
  page: 0,
  statusFilter: "all",
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
    case "SET_STATUS_FILTER":
      // Reset page to 0 when the filter changes — no derived-state effect needed
      return { ...state, statusFilter: action.value, page: 0 };
    case "SET_PAGE":
      return { ...state, page: action.value };
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function BookingsPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { bookings, total, page, statusFilter, loading } = state;

  const fetchBookings = useCallback(async () => {
    dispatch({ type: "SET_LOADING" });

    let query = insforge.database
      .from("bookings")
      .select(
        "id, service_title, first_name, last_name, email, phone, date, time, duration, status",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, count } = await query;

    dispatch({
      type: "LOAD_SUCCESS",
      bookings: (data as Booking[] | null) ?? [],
      total: count ?? 0,
    });
  }, [page, statusFilter]);

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

        <select
          value={statusFilter}
          onChange={(e) =>
            dispatch({
              type: "SET_STATUS_FILTER",
              value: e.target.value as StatusFilter,
            })
          }
          className="border-sand-200 text-petroleum-700 placeholder:text-petroleum-100 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 sm:w-48"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
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
                    className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
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

        {/* Pagination */}
        <div className="border-sand-200 flex items-center justify-between border-t px-5 py-3">
          <p className="text-petroleum-400 text-sm">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                dispatch({ type: "SET_PAGE", value: Math.max(0, page - 1) })
              }
              disabled={page === 0 || loading}
              className="border-sand-200 text-petroleum-500 hover:bg-sand-50 rounded-xl border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() =>
                dispatch({
                  type: "SET_PAGE",
                  value: Math.min(totalPages - 1, page + 1),
                })
              }
              disabled={page >= totalPages - 1 || loading}
              className="border-sand-200 text-petroleum-500 hover:bg-sand-50 rounded-xl border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
