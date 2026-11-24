"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconX } from "@/components/ui/icons";
import { INPUT_CLASS } from "@/constants/form-styles";
import { getAccessToken } from "@/lib/client-session";
import { markBookingRefunded } from "@/actions/booking-refunds";
import type { MarkRefundError } from "@/lib/bookings/refund-rules";
import { formatPrice, type SupportedLocale } from "@/utils/format";
import { formatAmountInput, parseEuroAmount } from "@/utils/parse-amount";

/**
 * "Marcar como reembolsado": the confirmation that the money was returned in
 * the Redsys portal. It returns nothing itself, and says so. The amount starts
 * at what is owed (or what is left to return) and can be lowered for a
 * partial refund; the note is optional and goes into the history.
 */
export function MarkRefundedDialog({
  bookingId,
  amountEur,
  maxEur,
  orderId,
  duplicateOrderId,
  locale,
  onClose,
  onRecorded,
}: {
  bookingId: string;
  amountEur: number;
  maxEur: number;
  orderId: string | null;
  /** Set when what is returned is a DUPLICATE payment, under this order. */
  duplicateOrderId?: string;
  locale: SupportedLocale;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const t = useTranslations("dashboard.bookings.detail.refund.dialog");
  const tCommon = useTranslations("dashboard.common");
  const [amount, setAmount] = useState(() =>
    formatAmountInput(amountEur, locale),
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MarkRefundError | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // "1.000" is a thousand euros, "100,5" a hundred and fifty cents.
  const parsed = parseEuroAmount(amount);
  const valid =
    parsed !== null &&
    parsed > 0 &&
    Math.round(parsed * 100) <= Math.round(maxEur * 100);

  async function handleConfirm() {
    if (!valid || parsed === null) return;
    setSaving(true);
    setError(null);
    const result = await markBookingRefunded(getAccessToken(), {
      bookingId,
      amountEur: parsed,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(duplicateOrderId ? { duplicateOrderId } : {}),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onRecorded();
  }

  const errorText =
    error === "exceeds"
      ? t("errors.exceeds", { max: formatPrice(maxEur, locale) })
      : error === "invalid"
        ? t("errors.invalid")
        : error === "conflict" ||
            error === "not_cancelled" ||
            error === "nothing_to_refund"
          ? t("errors.changed")
          : error
            ? t("errors.generic")
            : null;

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-refunded-title"
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3
            id="mark-refunded-title"
            className="font-display text-petroleum-700 text-xl"
          >
            {t("title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <IconX />
          </button>
        </div>

        <p className="text-petroleum-500 text-sm">
          {orderId ? t("body", { order: orderId }) : t("bodyNoOrder")}
        </p>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="refund-amount"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("amount")}
          </label>
          <input
            id="refund-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={saving}
            className={INPUT_CLASS}
          />
          <p className="text-petroleum-400 text-xs">
            {t("max", { max: formatPrice(maxEur, locale) })}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="refund-note"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("note")}
          </label>
          <textarea
            id="refund-note"
            value={note}
            maxLength={500}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
            placeholder={t("notePlaceholder")}
            className={INPUT_CLASS}
          />
        </div>

        {errorText && <p className="text-sm text-red-600">{errorText}</p>}

        <div className="flex flex-col gap-2">
          <Button
            variant="solid"
            size="md"
            onClick={() => void handleConfirm()}
            disabled={saving || !valid}
            className="w-full"
          >
            {t("confirm")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={saving}
            className="w-full"
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
