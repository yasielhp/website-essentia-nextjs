"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { notifySuccess } from "@/lib/feedback";
import type { BookingRefundView } from "@/lib/bookings/refund-rules";
import { formatPrice, type SupportedLocale } from "@/utils/format";
import { MarkRefundedDialog } from "./mark-refunded-dialog";

/**
 * The money this booking took through Redsys: the order number the Redsys
 * portal asks for (it was on no screen before), what was paid online, and
 * where its refund stands: "Reembolso pendiente: 100,00 €" until an
 * administrator marks it as returned.
 */
export function RefundCard({
  bookingId,
  view,
  locale,
  onRecorded,
}: {
  bookingId: string;
  view: BookingRefundView;
  locale: SupportedLocale;
  onRecorded: () => void;
}) {
  const t = useTranslations("dashboard.bookings.detail.refund");
  const [open, setOpen] = useState(false);
  // The duplicate payment being marked as returned, by its order.
  const [openDuplicate, setOpenDuplicate] = useState<string | null>(null);
  const markingDuplicate = view.duplicates.find(
    (d) => d.orderId === openDuplicate,
  );
  const price = (eur: number) => formatPrice(eur, locale);
  const { state } = view;

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("title")}
      </h2>

      {state.kind === "owed" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            {t("owed", { amount: price(state.amountEur) })}
          </p>
          <p className="mt-1 text-xs text-amber-800">{t("owedHelp")}</p>
        </div>
      )}
      {/* Looks paid online but no Redsys charge is on record: a doubt to
      check in the portal, never a debt. */}
      {view.unverifiedEur > 0 && state.kind === "none" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-900">
            {t("unverified", {
              amount: price(view.unverifiedEur),
              order: view.orderId ?? "—",
            })}
          </p>
        </div>
      )}
      {state.kind === "refunded" && (
        <p className="bg-sand-100 text-petroleum-600 mb-4 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium">
          {t("refunded", { amount: price(state.amountEur) })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-petroleum-400 text-xs">{t("order")}</p>
          <p className="text-petroleum-700 font-mono text-sm select-all">
            {view.orderId ?? "—"}
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-petroleum-400 text-xs">{t("paidOnline")}</p>
          <p className="text-petroleum-700 text-sm">
            {view.onlineEur > 0 ? price(view.onlineEur) : "—"}
          </p>
        </div>
      </div>

      {/* Second payments for a booking already paid: each owed back on its
      own order, apart from the booking's own money. */}
      {view.duplicates.map((d) => (
        <div
          key={d.orderId}
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-amber-900">
            {t("duplicate", { amount: price(d.amountEur), order: d.orderId })}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {d.owedEur > 0
              ? t("duplicateOwed", { amount: price(d.owedEur) })
              : t("duplicateRefunded")}
          </p>
          {view.canMarkDuplicates && d.owedEur > 0 && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => setOpenDuplicate(d.orderId)}
              >
                {t("mark")}
              </Button>
            </div>
          )}
        </div>
      ))}

      {view.canMark && (
        <div className="mt-4">
          <Button variant="outline" size="md" onClick={() => setOpen(true)}>
            {t("mark")}
          </Button>
        </div>
      )}

      {open && (
        <MarkRefundedDialog
          bookingId={bookingId}
          amountEur={
            state.kind === "owed" ? state.amountEur : view.refundableEur
          }
          maxEur={view.refundableEur}
          orderId={view.orderId}
          locale={locale}
          onClose={() => setOpen(false)}
          onRecorded={() => {
            setOpen(false);
            notifySuccess(t("done"));
            onRecorded();
          }}
        />
      )}
      {markingDuplicate && (
        <MarkRefundedDialog
          bookingId={bookingId}
          amountEur={markingDuplicate.owedEur}
          maxEur={markingDuplicate.owedEur}
          orderId={markingDuplicate.orderId}
          duplicateOrderId={markingDuplicate.orderId}
          locale={locale}
          onClose={() => setOpenDuplicate(null)}
          onRecorded={() => {
            setOpenDuplicate(null);
            notifySuccess(t("done"));
            onRecorded();
          }}
        />
      )}
    </div>
  );
}
