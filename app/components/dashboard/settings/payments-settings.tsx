"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { INPUT_CLASS } from "@/constants/form-styles";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import {
  getPublicPaymentSettings,
  savePaymentSettings,
} from "@/actions/payment-settings";
import {
  DEFAULT_PAYMENT_SETTINGS,
  type PaymentSettings,
} from "@/lib/payments/amounts";

/**
 * What the public booking form asks for: how much to pay now, what paying
 * everything saves, and an emergency switch for taking bookings without pay.
 *
 * Percentages are held as typed and only parsed on save, so clearing a field
 * to type another number does not snap back to zero in between.
 */
export function PaymentsSettings() {
  const t = useTranslations("dashboard.settings.payments");
  const [loaded, setLoaded] = useState(false);
  const [deposit, setDeposit] = useState(
    String(DEFAULT_PAYMENT_SETTINGS.depositPercent),
  );
  const [discount, setDiscount] = useState(
    String(DEFAULT_PAYMENT_SETTINGS.fullPaymentDiscountPercent),
  );
  const [requirePayment, setRequirePayment] = useState(
    DEFAULT_PAYMENT_SETTINGS.requirePayment,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPublicPaymentSettings().then((s) => {
      if (cancelled) return;
      setDeposit(String(s.depositPercent));
      setDiscount(String(s.fullPaymentDiscountPercent));
      setRequirePayment(s.requirePayment);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const value: PaymentSettings = {
      depositPercent: Number(deposit),
      fullPaymentDiscountPercent: Number(discount),
      requirePayment,
    };
    setSaving(true);
    setError(null);
    const result = await savePaymentSettings(getAccessToken(), value);
    setSaving(false);
    if (result.error) {
      setError(t("error"));
      return;
    }
    notifySuccess(t("saved"));
  }

  return (
    <div className="flex max-w-md flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="deposit-percent"
          className="text-petroleum-500 text-xs font-medium"
        >
          {t("depositPercent")}
        </label>
        <input
          id="deposit-percent"
          type="number"
          min={10}
          max={100}
          step={1}
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          disabled={!loaded || saving}
          className={INPUT_CLASS}
        />
        <p className="text-petroleum-400 text-xs">{t("depositHint")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="full-discount"
          className="text-petroleum-500 text-xs font-medium"
        >
          {t("fullDiscount")}
        </label>
        <input
          id="full-discount"
          type="number"
          min={0}
          max={50}
          step={1}
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          disabled={!loaded || saving}
          className={INPUT_CLASS}
        />
        <p className="text-petroleum-400 text-xs">{t("fullDiscountHint")}</p>
      </div>

      <ToggleRow
        checked={requirePayment}
        onToggle={() => setRequirePayment((v) => !v)}
        label={t("requirePayment")}
        hint={t("requirePaymentHint")}
        disabled={!loaded || saving}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <Button
          variant="solid"
          size="md"
          onClick={() => void handleSave()}
          disabled={!loaded || saving}
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
