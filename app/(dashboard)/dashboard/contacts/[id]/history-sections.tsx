"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { formatMediumDate, formatPrice } from "@/utils/format";
import {
  LocationBadge,
  SourceBadge,
  StatusBadge,
} from "@/components/dashboard/booking-cells";
import {
  formatBookingDate,
  formatCreatedDate,
  formatCreatedTime,
  locationDetail,
} from "@/utils/booking-display";
import type {
  ContactBooking as Booking,
  ContactMembership as Membership,
  ContactRaceReg as RaceReg,
  ContactEduReg as EduReg,
} from "@/types/contact";

/**
 * The four views of one person's history: every payment, their bookings, the
 * races they entered and the courses they took.
 *
 * All four used to sit in the detail page along with the form, the delete
 * dialog and the loading reducer — some seven hundred lines, of which this is
 * the part nobody was looking for when they opened the file.
 */
function RowSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-sand-100 h-10 animate-pulse rounded-xl" />
      ))}
      <span className="sr-only">{cols}</span>
    </div>
  );
}

/**
 * Everything this contact has transacted, in one list.
 *
 * There is no `transactions` table — the dashboard's transactions screen
 * derives its rows from bookings, memberships and registrations, and this
 * mirrors it for a single person.
 *
 * Rows without an amount are still transactions. Filtering them out hid drafts,
 * memberships and registrations, which is most of what some contacts have.
 *
 * The status is the payment's, not the appointment's. Counting a confirmed
 * booking as "completed" marked all 77 of them settled while every
 * `payment_status` in the database is still `pending` — a column of money
 * saying it had been collected when none of it had.
 */
type TransactionRow = {
  id: string;
  kind: string;
  title: string;
  date: string | null;
  amount: number | null;
  status: string;
  created_at: string | null;
};

function bookingStatus(b: Booking): string {
  if (b.payment_status === "paid") return "completed";
  // A cancelled appointment is not a pending charge, whatever the payment row
  // still says.
  if (b.status === "cancelled") return "cancelled";
  return b.payment_status ?? "—";
}

const TX_STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  paid: "bg-green-50 text-green-700",
  active: "bg-green-50 text-green-700",
  confirmed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-red-50 text-red-700",
  cancelled: "bg-red-50 text-red-700",
};

export function TransactionsSection({
  loading,
  bookings,
  memberships,
  raceRegs,
  eduRegs,
}: {
  loading: boolean;
  bookings: Booking[];
  memberships: Membership[];
  raceRegs: RaceReg[];
  eduRegs: EduReg[];
}) {
  const t = useTranslations("dashboard.contacts.detail.transactions");
  const locale = useDashboardLocale();
  const rows: TransactionRow[] = [
    ...bookings.map((b) => ({
      id: b.id,
      kind: "Booking",
      title: b.service_title ?? "—",
      date: b.date,
      amount: b.price_eur,
      status: bookingStatus(b),
      created_at: b.created_at,
    })),
    ...memberships.map((m) => ({
      id: m.id,
      kind: "Membership",
      title: m.plan ?? "Membership",
      date: m.start_date,
      amount: null,
      status: m.status ?? "—",
      created_at: m.created_at,
    })),
    ...raceRegs.map((r) => ({
      id: r.id,
      kind: "Race",
      title: r.race?.title ?? "—",
      date: r.race?.date ?? r.created_at,
      amount: null,
      status: "confirmed",
      created_at: r.created_at,
    })),
    ...eduRegs.map((r) => ({
      id: r.id,
      kind: "Education",
      title: r.session?.title ?? "—",
      date: r.session?.date ?? r.created_at,
      amount: null,
      status: "confirmed",
      created_at: r.created_at,
    })),
  ].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  const paidTotal = bookings
    .filter((b) => b.payment_status === "paid")
    .reduce((sum, b) => sum + (b.price_eur ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        {!loading && paidTotal > 0 && (
          <span className="text-petroleum-400 text-xs">
            Paid to date{" "}
            <span className="text-petroleum-700 font-medium">
              {formatPrice(paidTotal, locale)}
            </span>
          </span>
        )}
      </div>
      {loading ? (
        <RowSkeleton cols={5} />
      ) : rows.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {["type", "concept", "date", "amount", "status"].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {t(`columns.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.kind}-${r.id}`}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-400 py-3 pr-4 text-xs">
                    {r.kind}
                  </td>
                  <td className="text-petroleum-700 py-3 pr-4 font-medium">
                    {r.title}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {formatMediumDate(r.date, locale)}
                  </td>
                  <td className="text-petroleum-700 py-3 pr-4">
                    {r.amount == null ? "—" : formatPrice(r.amount, locale)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        TX_STATUS_STYLES[r.status] ??
                        "bg-sand-100 text-petroleum-500"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export /**
 * The same table as the bookings list, minus the client column — the page is
 * already about one person. Rows link through to the booking, as they do there.
 */
function BookingsSection({
  loading,
  bookings,
}: {
  loading: boolean;
  bookings: Booking[];
}) {
  const t = useTranslations("dashboard");
  const tSection = useTranslations("dashboard.contacts.detail.bookings");
  const locale = useLocale();
  const { push } = useRouter();

  return (
    <div>
      {loading ? (
        <RowSkeleton cols={5} />
      ) : bookings.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{tSection("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {[
                  "created",
                  "status",
                  "service",
                  "location",
                  "datetime",
                  "reservedBy",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {tSection(`columns.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const detail = locationDetail(
                  b.location,
                  b.location_address,
                  (number) => t("bookings.room", { number }),
                );
                return (
                  <tr
                    key={b.id}
                    onClick={() => push(`/dashboard/bookings/${b.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <p className="text-petroleum-500">
                        {/* The row is clickable for a mouse; this is the same
                            destination as something a keyboard can reach. */}
                        <Link
                          href={`/dashboard/bookings/${b.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded outline-offset-2"
                        >
                          {formatCreatedDate(b.created_at, locale)}
                        </Link>
                      </p>
                      <p className="text-petroleum-400 text-xs">
                        {formatCreatedTime(b.created_at, locale)}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-petroleum-700 font-medium">
                        {b.service_title ?? "—"}
                      </p>
                      {b.duration && (
                        <p className="text-petroleum-400 text-xs">
                          {b.duration}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <LocationBadge location={b.location} />
                      {detail && (
                        <p className="text-petroleum-400 mt-1 text-xs">
                          {detail}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-petroleum-500">
                        {formatBookingDate(b.date, locale)}
                      </p>
                      {b.time && (
                        <p className="text-petroleum-400 text-xs">{b.time}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <SourceBadge role={b.created_by_role} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RaceRegsSection({
  loading,
  raceRegs,
}: {
  loading: boolean;
  raceRegs: RaceReg[];
}) {
  const t = useTranslations("dashboard.contacts.detail.races");
  const locale = useDashboardLocale();
  return (
    <div>
      {loading ? (
        <RowSkeleton cols={4} />
      ) : raceRegs.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {["race", "date", "location", "registered"].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {t(`columns.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {raceRegs.map((r) => (
                <tr
                  key={r.id}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-700 py-3 pr-4 font-medium">
                    {r.race?.title ?? "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.race?.date ? formatMediumDate(r.race.date, locale) : "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.race?.location ?? "—"}
                  </td>
                  <td className="text-petroleum-400 py-3">
                    {formatMediumDate(r.created_at, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function EduRegsSection({
  loading,
  eduRegs,
}: {
  loading: boolean;
  eduRegs: EduReg[];
}) {
  const t = useTranslations("dashboard.contacts.detail.education");
  const locale = useDashboardLocale();
  return (
    <div>
      {loading ? (
        <RowSkeleton cols={4} />
      ) : eduRegs.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-sand-100 border-b text-left">
                {["session", "date", "location", "registered"].map((h) => (
                  <th
                    key={h}
                    className="text-petroleum-400 pr-4 pb-2.5 font-medium"
                  >
                    {t(`columns.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eduRegs.map((r) => (
                <tr
                  key={r.id}
                  className="border-sand-50 border-b last:border-0"
                >
                  <td className="text-petroleum-700 py-3 pr-4 font-medium">
                    {r.session?.title ?? "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.session?.date
                      ? formatMediumDate(r.session.date, locale)
                      : "—"}
                  </td>
                  <td className="text-petroleum-500 py-3 pr-4">
                    {r.session?.location ?? "—"}
                  </td>
                  <td className="text-petroleum-400 py-3">
                    {formatMediumDate(r.created_at, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
