"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { IconX } from "@/components/ui/icons";
import { getAccessToken } from "@/lib/client-session";
import { fetchBookingPeek } from "@/actions/booking-peek";
import { effectivePayment } from "@/lib/payments/amounts";
import { formatPrice, type SupportedLocale } from "@/utils/format";
import { locationDetail } from "@/utils/booking-display";
import type { BookingPeek } from "@/types/booking";

const PAYMENT_BADGE: Record<string, string> = {
  deposit_paid: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-600",
  refunded: "bg-sand-100 text-petroleum-500",
};

const LINK_CLASS =
  "border-sand-200 text-petroleum-700 hover:bg-sand-50 inline-flex h-9 flex-1 items-center justify-center rounded-full border bg-white px-4 text-sm transition-colors";

/**
 * A booking, from the calendar, without leaving it.
 *
 * Clicking a pill used to navigate away, so checking three appointments meant
 * three page loads and three trips back. The sheet answers "who, when, paid?"
 * and links to the full pages for anything more.
 */
export function EventSheet({
  bookingId,
  onClose,
}: {
  bookingId: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!bookingId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bookingId, onClose]);

  if (!bookingId) return null;
  // Keyed so a second booking starts from the loading state, not the first.
  return <SheetBody key={bookingId} bookingId={bookingId} onClose={onClose} />;
}

function SheetBody({
  bookingId,
  onClose,
}: {
  bookingId: string;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard.calendar.sheet");
  const tBookings = useTranslations("dashboard.bookings");
  const tPayment = useTranslations("dashboard.bookings.paymentStatus");
  const tCommon = useTranslations("dashboard.common");
  const locale = useLocale() as SupportedLocale;
  const overlayRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "missing" }
    | { kind: "ready"; b: BookingPeek }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void fetchBookingPeek(getAccessToken(), bookingId)
      .then((b) => {
        if (!cancelled)
          setState(b ? { kind: "ready", b } : { kind: "missing" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="animate-slide-in-right border-sand-200 flex h-full w-full max-w-md flex-col overflow-y-auto border-l bg-white shadow-xl"
      >
        <div className="border-sand-200 flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display text-petroleum-700 text-xl">
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <IconX />
          </button>
        </div>

        {state.kind === "loading" && <SheetSkeleton />}

        {state.kind === "missing" && (
          <p className="text-petroleum-400 p-6 text-sm">{t("notFound")}</p>
        )}

        {state.kind === "ready" && (
          <SheetContent
            b={state.b}
            locale={locale}
            statusLabel={
              state.b.status && tBookings.has(`status.${state.b.status}`)
                ? tBookings(`status.${state.b.status}`)
                : (state.b.status ?? "—")
            }
            paymentLabel={
              tPayment.has(effectivePayment(state.b).status)
                ? tPayment(effectivePayment(state.b).status)
                : effectivePayment(state.b).status
            }
          />
        )}
      </aside>
    </div>
  );
}

/**
 * `location_address` is JSON, not prose: reservation and room numbers for a
 * hotel booking, a street address for a home visit.
 */
function placeDetail(
  b: BookingPeek,
  roomLabel: (number: string) => string,
): string | null {
  if (b.location === "domicilio") {
    try {
      const a = JSON.parse(b.location_address ?? "") as Record<string, string>;
      const parts = [
        a.street,
        a.building,
        [a.postalCode, a.municipality].filter(Boolean).join(" "),
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : null;
    } catch {
      return null;
    }
  }
  return locationDetail(b.location, b.location_address, roomLabel);
}

function Bar({ className }: { className: string }) {
  return (
    <div className={`bg-sand-200 animate-pulse rounded-md ${className}`} />
  );
}

/** A label over a value: the shape of `Field`, before there is anything to say. */
function FieldSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className="space-y-2">
      <Bar className="h-3 w-14" />
      <Bar className={`h-4 ${wide ? "w-32" : "w-20"}`} />
    </div>
  );
}

/** The sheet's own layout, so nothing jumps when the booking arrives. */
function SheetSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col gap-4 p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="border-sand-200 rounded-2xl border bg-white p-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FieldSkeleton wide />
          <FieldSkeleton />
          <FieldSkeleton wide />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton wide />
          <FieldSkeleton wide />
          <FieldSkeleton />
        </div>
        <div className="border-sand-200 mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <Bar className="mt-4 h-9 w-full rounded-full" />
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white p-5">
        <div className="space-y-2">
          <Bar className="h-3 w-14" />
          <Bar className="h-5 w-40" />
          <Bar className="h-4 w-32" />
          <Bar className="h-4 w-44" />
        </div>
        <Bar className="mt-4 h-9 w-full rounded-full" />
      </div>
    </div>
  );
}

/** `2026-10-15` as `15/10/2026`, day first in both languages: no US ambiguity. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** A label with its value under it; renders nothing when there is no value. */
function Field({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | null | undefined;
  detail?: string | null;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-petroleum-400 text-xs">{label}</dt>
      <dd className="text-petroleum-700 mt-0.5 text-sm font-medium">{value}</dd>
      {detail && <dd className="text-petroleum-500 text-xs">{detail}</dd>}
    </div>
  );
}

function SheetContent({
  b,
  locale,
  statusLabel,
  paymentLabel,
}: {
  b: BookingPeek;
  locale: SupportedLocale;
  statusLabel: string;
  paymentLabel: string;
}) {
  const t = useTranslations("dashboard.calendar.sheet");
  const tPay = useTranslations("dashboard.bookings.detail.payment");
  const tLocations = useTranslations("dashboard.bookings.locations");

  const name = [b.first_name, b.last_name].filter(Boolean).join(" ") || "—";
  const pay = effectivePayment(b);
  const owed = pay.owedEur;
  const hasMoney = pay.paidEur > 0 || owed > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="border-sand-200 rounded-2xl border bg-white p-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label={t("category")} value={b.service_title} />
          <Field label={t("service")} value={b.service_tiers?.label} />
          <Field label={t("date")} value={b.date ? shortDate(b.date) : null} />
          <Field label={t("time")} value={b.time} />
          <Field label={t("duration")} value={b.duration} />
          <Field label={t("staff")} value={b.staff_name ?? t("unassigned")} />
          <Field
            label={t("location")}
            value={
              b.location && tLocations.has(b.location)
                ? tLocations(b.location)
                : b.location
            }
            detail={placeDetail(b, (number) => number)}
          />
          <Field
            label={t("price")}
            value={
              b.price_eur != null ? formatPrice(b.price_eur, locale) : null
            }
          />
        </dl>
        <dl className="border-sand-200 mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-4">
          <div>
            <dt className="text-petroleum-400 text-xs">{t("status")}</dt>
            <dd className="text-petroleum-700 mt-0.5 text-sm font-medium">
              {statusLabel}
            </dd>
          </div>
          <div>
            <dt className="text-petroleum-400 text-xs">{t("transaction")}</dt>
            <dd className="mt-0.5">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  PAYMENT_BADGE[pay.status] ?? "bg-sand-200 text-petroleum-500"
                }`}
              >
                {paymentLabel}
              </span>
            </dd>
          </div>
        </dl>
        {hasMoney && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4">
            <Field
              label={tPay("paid")}
              value={formatPrice(pay.paidEur, locale)}
            />
            {/* Only when something is still to be collected. */}
            {owed > 0 && (
              <div>
                <dt className="text-petroleum-400 text-xs">{tPay("owed")}</dt>
                <dd className="mt-0.5 text-sm font-medium text-amber-700">
                  {formatPrice(owed, locale)}
                </dd>
              </div>
            )}
          </dl>
        )}
        <div className="border-sand-100 mt-4 flex gap-2 border-t pt-4">
          <Link href={`/dashboard/bookings/${b.id}`} className={LINK_CLASS}>
            {t("viewBooking")}
          </Link>
        </div>
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white p-5">
        <p className="text-petroleum-400 text-xs">{t("client")}</p>
        <p className="text-petroleum-700 mt-0.5 font-medium">{name}</p>
        {b.phone && <p className="text-petroleum-500 text-sm">{b.phone}</p>}
        {b.email && <p className="text-petroleum-500 text-sm">{b.email}</p>}
        {b.contact_id && (
          <div className="border-sand-100 mt-4 flex border-t pt-4">
            <Link
              href={`/dashboard/contacts/${b.contact_id}`}
              className={LINK_CLASS}
            >
              {t("viewContact")}
            </Link>
          </div>
        )}
      </div>

      {b.notes?.trim() && (
        <div className="border-sand-200 rounded-2xl border bg-white p-5">
          <p className="text-petroleum-400 text-xs">{t("notes")}</p>
          <p className="text-petroleum-700 mt-0.5 text-sm whitespace-pre-line">
            {b.notes.trim()}
          </p>
        </div>
      )}
    </div>
  );
}
