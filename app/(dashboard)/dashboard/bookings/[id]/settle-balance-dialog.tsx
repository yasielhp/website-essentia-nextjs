"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconX } from "@/components/ui/icons";
import { OptionSelect } from "@/components/ui/option-select";
import { INPUT_CLASS } from "@/constants/form-styles";
import { getAccessToken } from "@/lib/client-session";
import { recordCounterPayment } from "@/actions/booking-payment";
import type { BalanceMethod } from "@/types/booking";

const METHODS: BalanceMethod[] = ["cash", "card", "transfer", "other"];

/**
 * Money taken at the counter: the balance of a deposit, usually.
 *
 * The amount starts at what is still owed, so the common case is one click, and
 * stays editable for the client who leaves a little on account.
 */
export function SettleBalanceDialog({
  bookingId,
  owedEur,
  onClose,
  onRecorded,
}: {
  bookingId: string;
  owedEur: number;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const t = useTranslations("dashboard.bookings.detail.payment.dialog");
  const tCommon = useTranslations("dashboard.common");

  const [amount, setAmount] = useState(String(owedEur));
  const [method, setMethod] = useState<BalanceMethod>("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parsed = Number(amount.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed > 0;

  async function handleConfirm() {
    if (!valid) return;
    setSaving(true);
    setError(null);
    const result = await recordCounterPayment(getAccessToken(), {
      bookingId,
      amountEur: parsed,
      method,
    });
    setSaving(false);
    if (result.error) {
      setError(t("error"));
      return;
    }
    onRecorded();
  }

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-petroleum-700 text-xl">
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

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="settle-amount"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("amount")}
          </label>
          <input
            id="settle-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={saving}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="settle-method"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("method")}
          </label>
          <OptionSelect
            id="settle-method"
            value={method}
            options={METHODS.map((value) => ({
              value,
              label: t(`methods.${value}`),
            }))}
            onChange={setMethod}
            disabled={saving}
            ariaLabel={t("method")}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

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
