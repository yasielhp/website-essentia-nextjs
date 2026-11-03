"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { formatBookingDate, formatPrice } from "@/utils/format";
import type { ContactBonus } from "@/types/bonus";
import { GrantBonusDialog } from "./grant-bonus-dialog";

/** `YYYY-MM-DD` of today in the browser's calendar, for the expiry colour. */
function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The bonuses this contact bought: how many sessions are used and left, when
 * they expire, and which bookings consumed them.
 */
export function BonusesSection({
  loading,
  bonuses,
  contactId,
  onChanged,
}: {
  loading: boolean;
  bonuses: ContactBonus[];
  contactId: string;
  onChanged: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.bonuses");
  const tMethods = useTranslations(
    "dashboard.bookings.detail.payment.dialog.methods",
  );
  const tStatus = useTranslations("dashboard.bookings.status");
  const locale = useDashboardLocale();
  const [granting, setGranting] = useState(false);
  const today = todayLocal();

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Button
          variant="solid"
          size="sm"
          onClick={() => setGranting(true)}
          disabled={loading}
        >
          {t("add")}
        </Button>
      </div>

      {loading ? (
        <div className="bg-sand-100 h-24 animate-pulse rounded-xl" />
      ) : bonuses.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {bonuses.map((b) => {
            const expired = b.expiresAt < today;
            const percent = Math.min(
              100,
              Math.round((b.used / b.sessionsTotal) * 100),
            );
            return (
              <div
                key={b.id}
                className="border-sand-200 rounded-2xl border bg-white p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-petroleum-700 font-medium">{b.name}</p>
                  <p className="text-petroleum-400 text-xs">
                    {b.tierLabel ?? "—"}
                  </p>
                </div>

                <p className="text-petroleum-700 mt-3 text-sm">
                  {t("used", { used: b.used, total: b.sessionsTotal })} ·{" "}
                  <span className="font-medium">
                    {t("remaining", { n: b.remaining })}
                  </span>
                </p>
                <div
                  className="bg-sand-100 mt-2 h-2 overflow-hidden rounded-full"
                  role="progressbar"
                  aria-valuenow={b.used}
                  aria-valuemin={0}
                  aria-valuemax={b.sessionsTotal}
                >
                  <div
                    className="bg-petroleum-700 h-full rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <p
                  className={`mt-3 text-xs ${expired ? "text-red-600" : "text-petroleum-500"}`}
                >
                  {expired
                    ? `${t("expired")} · ${formatBookingDate(b.expiresAt, locale)}`
                    : t("expires", {
                        date: formatBookingDate(b.expiresAt, locale),
                      })}
                </p>
                <p className="text-petroleum-400 text-xs">
                  {t("purchased", {
                    date: formatBookingDate(b.purchasedAt, locale),
                  })}{" "}
                  · {formatPrice(b.priceEur, locale)}
                  {b.paidMethod && b.paidMethod !== "online"
                    ? ` · ${tMethods(b.paidMethod)}`
                    : ""}
                </p>
                {b.notes && (
                  <p className="text-petroleum-500 mt-1 text-xs">{b.notes}</p>
                )}

                {b.bookings.length > 0 && (
                  <ul className="border-sand-100 mt-3 space-y-1 border-t pt-3">
                    {b.bookings.map((u) => (
                      <li key={u.id} className="text-sm">
                        <Link
                          href={`/dashboard/bookings/${u.id}`}
                          className="text-petroleum-500 hover:text-petroleum-700 underline"
                        >
                          {u.date ? formatBookingDate(u.date, locale) : "—"}
                          {u.time ? ` · ${u.time}` : ""}
                        </Link>{" "}
                        <span className="text-petroleum-400 text-xs">
                          {u.status && tStatus.has(u.status)
                            ? tStatus(u.status)
                            : (u.status ?? "")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {granting && (
        <GrantBonusDialog
          contactId={contactId}
          onClose={() => setGranting(false)}
          onGranted={() => {
            setGranting(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
