"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────

type BookingDetail = {
  id: string;
  service_title: string | null;
  duration: string | null;
  price_eur: number | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  location: string | null;
  location_address: string | null;
  created_at: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCreated(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseLocationAddress(
  raw: string | null,
): Record<string, string> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

const statusDotClasses: Record<string, string> = {
  pending: "bg-yellow-400",
  confirmed: "bg-green-500",
  cancelled: "bg-red-400",
};

const locationLabels: Record<string, string> = {
  centro: "At the center",
  habitacion: "Room",
  domicilio: "Home visit",
};

// ─── Detail row ───────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-petroleum-400 text-xs">{label}</p>
      <div className="text-petroleum-700 text-sm">{children}</div>
    </div>
  );
}

// ─── Delete dialog ────────────────────────────────────────────

function DeleteDialog({
  deleting,
  onConfirm,
  onCancel,
}: {
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            Delete booking?
          </h3>
          <p className="text-petroleum-400 text-sm">
            This booking will be permanently deleted.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── State ────────────────────────────────────────────────────

type PageState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "loaded"; booking: BookingDetail };

// ─── Page ─────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { push } = useRouter();

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("bookings")
        .select(
          "id, service_title, duration, price_eur, first_name, last_name, email, phone, date, time, status, location, location_address, created_at",
        )
        .eq("id", id)
        .limit(1);

      const booking = (data as BookingDetail[] | null)?.[0];
      if (!booking) {
        setState({ kind: "not_found" });
        return;
      }
      setState({ kind: "loaded", booking });
    }
    void load();
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    await insforge.database.from("bookings").delete().eq("id", id);
    push("/dashboard/bookings");
  }

  if (state.kind === "loading") {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="bg-sand-100 h-9 w-48 animate-pulse rounded-xl" />
          <div className="flex gap-3">
            <div className="bg-sand-100 h-10 w-20 animate-pulse rounded-xl" />
            <div className="bg-sand-100 h-10 w-20 animate-pulse rounded-xl" />
          </div>
        </div>
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border-sand-200 rounded-2xl border bg-white p-6"
            >
              <div className="bg-sand-100 mb-4 h-4 w-24 animate-pulse rounded" />
              <div className="space-y-3">
                <div className="bg-sand-100 h-4 w-full animate-pulse rounded" />
                <div className="bg-sand-100 h-4 w-2/3 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-petroleum-400 text-sm">Booking not found.</p>
        <Link
          href="/dashboard/bookings"
          className="text-petroleum-400 hover:text-petroleum-700 mt-4 text-xs underline"
        >
          Back to bookings
        </Link>
      </div>
    );
  }

  const { booking } = state;
  const addrParsed = parseLocationAddress(booking.location_address);
  const fullName =
    [booking.first_name, booking.last_name].filter(Boolean).join(" ") || "—";

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/bookings"
            className="text-petroleum-400 hover:text-petroleum-700 text-sm transition-colors"
          >
            ← Bookings
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="outline-danger"
              size="md"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
            <Button
              variant="solid"
              size="md"
              href={`/dashboard/bookings/${id}/edit`}
            >
              Edit
            </Button>
          </div>
        </div>
        <h1 className="font-display text-petroleum-700 text-2xl">{fullName}</h1>
      </div>

      {/* Meta strip */}
      <div className="border-sand-200 divide-sand-200 mb-6 grid grid-cols-3 divide-x rounded-2xl border bg-white">
        <div className="flex flex-col gap-1.5 px-5 py-4">
          <p className="text-petroleum-400 text-xs">Status</p>
          <div className="flex items-center gap-1.5">
            <span
              className={`size-2 shrink-0 rounded-full ${statusDotClasses[booking.status ?? ""] ?? "bg-petroleum-300"}`}
            />
            <span className="text-petroleum-700 text-sm font-medium capitalize">
              {booking.status ?? "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 px-5 py-4">
          <p className="text-petroleum-400 text-xs">Location</p>
          <p className="text-petroleum-700 text-sm">
            {locationLabels[booking.location ?? ""] ?? "—"}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 px-5 py-4">
          <p className="text-petroleum-400 text-xs">Created</p>
          <p className="text-petroleum-700 text-sm">
            {formatCreated(booking.created_at)}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Service */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            Service
          </h2>
          <div className="flex items-center gap-4">
            <div className="bg-petroleum-100 flex size-14 shrink-0 items-center justify-center rounded-xl">
              <span className="text-petroleum-700 text-xl font-bold">
                {booking.service_title?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-petroleum-700 font-medium">
                {booking.service_title ?? "—"}
              </p>
              {(booking.duration || booking.price_eur != null) && (
                <p className="text-petroleum-400 text-sm">
                  {[
                    booking.duration,
                    booking.price_eur != null ? `€${booking.price_eur}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Location */}
        {booking.location && (
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Location
            </h2>
            <div className="flex flex-col gap-3">
              {booking.location === "habitacion" && addrParsed && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Room number">
                    {addrParsed.roomNumber ?? "—"}
                  </Field>
                  <Field label="Reservation number">
                    {addrParsed.reservationNumber || "—"}
                  </Field>
                </div>
              )}

              {booking.location === "domicilio" && addrParsed && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Street & number">
                    {addrParsed.street ?? "—"}
                  </Field>
                  {addrParsed.building && (
                    <Field label="Block, floor & door">
                      {addrParsed.building}
                    </Field>
                  )}
                  <Field label="Postal code">
                    {addrParsed.postalCode ?? "—"}
                  </Field>
                  <Field label="Municipality">
                    {addrParsed.municipality ?? "—"}
                  </Field>
                </div>
              )}

              {booking.location === "centro" && (
                <p className="text-petroleum-400 text-sm">
                  Baobab Suites, Costa Adeje, Tenerife
                </p>
              )}
            </div>
          </div>
        )}

        {/* Date & time */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            Date & time
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">{formatDate(booking.date)}</Field>
            <Field label="Time">{booking.time ?? "—"}</Field>
          </div>
        </div>

        {/* Client */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            Client
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">{fullName}</Field>
            <Field label="Phone">{booking.phone ?? "—"}</Field>
            <Field label="Email">{booking.email ?? "—"}</Field>
          </div>
        </div>
      </div>

      {deleteOpen && (
        <DeleteDialog
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
