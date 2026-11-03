"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { IconX } from "@/components/ui/icons";
import { getAccessToken } from "@/lib/client-session";
import { fetchBookingPeek } from "@/actions/booking-peek";
import { amountOwed } from "@/lib/payments/amounts";
import {
  formatBookingDate,
  formatPrice,
  type SupportedLocale,
} from "@/utils/format";
import type { BookingPeek } from "@/types/booking";

const PAYMENT_BADGE: Record<string, string> = {
  deposit_paid: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-600",
  refunded: "bg-sand-100 text-petroleum-500",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-400",
  confirmed: "bg-green-500",
  cancelled: "bg-red-400",
};

const LINK_CLASS =
  "border-sand-200 text-petroleum-700 hover:bg-sand-50 inline-flex h-9 flex-1 items-center justify-center rounded-full border bg-white px-4 text-sm transition-colors";

const EDIT_CLASS =
  "bg-petroleum-700 hover:bg-petroleum-800 active:bg-petroleum-900 inline-flex h-9 flex-1 items-center justify-center rounded-full border border-transparent px-4 text-sm text-white transition-colors";

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
        className="bg-sand-100 animate-slide-in-right flex h-full w-full max-w-md flex-col overflow-y-auto shadow-xl"
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

        {state.kind === "loading" && (
          <div className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-sand-200 h-5 animate-pulse rounded-lg"
              />
            ))}
          </div>
        )}

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
              state.b.payment_status && tPayment.has(state.b.payment_status)
                ? tPayment(state.b.payment_status)
                : (state.b.payment_status ?? "—")
            }
          />
        )}
      </aside>
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

  const name = [b.first_name, b.last_name].filter(Boolean).join(" ") || "—";
  const onBonus = b.payment_mode === "bonus";
  const owed = onBonus ? 0 : amountOwed(b.price_eur, b.amount_paid_eur);
  const hasMoney = !onBonus && (Number(b.amount_paid_eur ?? 0) > 0 || owed > 0);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div
        className="rounded-2xl bg-white p-5"
        // The session type's colour as a wash over white, so the card reads as
        // the same appointment the calendar pill showed.
        style={
          b.service_tiers?.color
            ? {
                backgroundColor: `color-mix(in srgb, ${b.service_tiers.color} 14%, white)`,
              }
            : undefined
        }
      >
        <p className="text-petroleum-700 font-medium">
          {b.service_tiers?.label ?? b.service_title ?? "—"}
        </p>
        {b.service_tiers?.label && b.service_title && (
          <p className="text-petroleum-400 mt-0.5 text-sm">{b.service_title}</p>
        )}
        <p className="text-petroleum-500 mt-3 text-sm">
          {b.date ? formatBookingDate(b.date, locale) : "—"}
          {b.time ? ` · ${b.time}` : ""}
          {b.duration ? ` · ${b.duration}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-petroleum-700 inline-flex items-center gap-1.5 text-sm">
            <span
              className={`size-2 rounded-full ${STATUS_DOT[b.status ?? ""] ?? "bg-petroleum-400"}`}
            />
            {statusLabel}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              PAYMENT_BADGE[b.payment_status ?? ""] ??
              "bg-sand-200 text-petroleum-500"
            }`}
          >
            {paymentLabel}
          </span>
        </div>
        {hasMoney && (
          <p className="text-petroleum-700 mt-3 text-xs">
            {tPay("paid")} {formatPrice(b.amount_paid_eur ?? 0, locale)} ·{" "}
            {tPay("owed")} {formatPrice(owed, locale)}
          </p>
        )}
        <div className="border-sand-100 mt-4 flex gap-2 border-t pt-4">
          <Link href={`/dashboard/bookings/${b.id}`} className={LINK_CLASS}>
            {t("viewBooking")}
          </Link>
          <Link
            href={`/dashboard/bookings/${b.id}/edit`}
            className={EDIT_CLASS}
          >
            {t("editBooking")}
          </Link>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5">
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
        <div className="rounded-2xl bg-white p-5">
          <p className="text-petroleum-400 text-xs">{t("notes")}</p>
          <p className="text-petroleum-700 mt-0.5 text-sm whitespace-pre-line">
            {b.notes.trim()}
          </p>
        </div>
      )}
    </div>
  );
}
