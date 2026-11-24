"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatPrice } from "@/utils/format";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { isOutsideCancellationWindow } from "@/lib/bookings/cancellation-window";
import type { BookingRefundView } from "@/lib/bookings/refund-rules";

/**
 * What cancelling this booking does with the money paid online, said before
 * saving.
 *
 * At least 24 hours before the session the refund is owed, so there is
 * nothing to choose: the screen says what saving will record. Inside the last
 * 24 hours the Terms give no refund, and the team decides: the box starts
 * unticked, because most late cancellations are a client calling at the last
 * minute or not turning up; it is ticked when it is the centre that cancels.
 */
export function RefundOnCancel({
  view,
  date,
  time,
  refundLate,
  onChange,
  disabled,
}: {
  view: BookingRefundView | null;
  /** The session as it was saved, not as the form may have moved it. */
  date: string | null;
  time: string;
  refundLate: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const t = useTranslations("dashboard.bookings.edit.refund");
  const locale = useDashboardLocale();
  // Read once: the answer must not change under the person while they read it.
  const [now] = useState(() => Date.now());

  if (!view || view.refundableEur <= 0) return null;
  const amount = formatPrice(view.refundableEur, locale);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      {isOutsideCancellationWindow(date, time, now) ? (
        <p className="text-petroleum-700 text-sm">
          {t("inAdvance", { amount })}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="refund-late"
            className="flex cursor-pointer items-center gap-2"
          >
            <input
              id="refund-late"
              type="checkbox"
              checked={refundLate}
              disabled={disabled}
              onChange={() => onChange(!refundLate)}
              className="accent-petroleum-700 size-4"
            />
            <span className="text-petroleum-700 text-sm font-medium">
              {t("lateLabel", { amount })}
            </span>
          </label>
          <p className="text-petroleum-500 text-xs">{t("lateHelp")}</p>
        </div>
      )}
    </div>
  );
}
