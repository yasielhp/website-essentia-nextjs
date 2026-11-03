"use client";

import { useTranslations } from "next-intl";
import { OptionSelect } from "@/components/ui/option-select";
import { INPUT_CLASS } from "@/constants/form-styles";
import type { BalanceMethod } from "@/types/booking";

export type PaymentFormStatus = "pending" | "deposit_paid" | "paid";

/** What the person at the desk says about the money for one booking. */
export type PaymentValue = {
  status: PaymentFormStatus;
  /** Euros as typed; empty while nothing has been collected. */
  amountPaid: string;
  method: BalanceMethod | "";
};

export const EMPTY_PAYMENT: PaymentValue = {
  status: "pending",
  amountPaid: "",
  method: "",
};

const STATUSES: PaymentFormStatus[] = ["pending", "deposit_paid", "paid"];
const METHODS: BalanceMethod[] = ["cash", "card", "transfer", "other"];

/**
 * A stored row as the form shows it. `failed` and `refunded` have no place in a
 * three-way choice, so they read as `pending`; the edit screen only writes the
 * payment when the value differs from this reading, so they survive a save.
 */
export function paymentValueOf(row: {
  payment_status: string | null;
  amount_paid_eur: number | string | null;
  balance_settled_method: string | null;
}): PaymentValue {
  const status: PaymentFormStatus =
    row.payment_status === "paid" || row.payment_status === "deposit_paid"
      ? row.payment_status
      : "pending";
  const paid = Number(row.amount_paid_eur ?? 0);
  return {
    status,
    amountPaid: paid > 0 ? String(paid) : "",
    method: (row.balance_settled_method as BalanceMethod | null) ?? "",
  };
}

/** The mode a booking written at the desk gets from its payment state. */
export function paymentModeFor(
  status: PaymentFormStatus,
): "none" | "full" | "deposit" {
  return status === "pending" ? "none" : status === "paid" ? "full" : "deposit";
}

/** The euros typed, 0 when empty or unreadable. */
export function amountPaidOf(value: PaymentValue): number {
  if (value.status === "pending") return 0;
  const n = Number(value.amountPaid.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function PaymentFields({
  value,
  priceEur,
  onChange,
  disabled = false,
}: {
  value: PaymentValue;
  /** The price of the booking, used to prefill "paid in full". */
  priceEur: number | null;
  onChange: (next: PaymentValue) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("dashboard.bookings.form.payment");
  const tStatus = useTranslations("dashboard.bookings.paymentStatus");
  const tMethods = useTranslations(
    "dashboard.bookings.detail.payment.dialog.methods",
  );

  function setStatus(status: PaymentFormStatus) {
    if (status === "pending") {
      onChange({ status, amountPaid: "", method: "" });
      return;
    }
    onChange({
      ...value,
      status,
      amountPaid:
        status === "paid" && !value.amountPaid && priceEur != null
          ? String(priceEur)
          : value.amountPaid,
    });
  }

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("title")}
      </h2>
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="payment-status"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("status")}
          </label>
          <OptionSelect
            id="payment-status"
            value={value.status}
            options={STATUSES.map((s) => ({ value: s, label: tStatus(s) }))}
            onChange={setStatus}
            disabled={disabled}
            ariaLabel={t("status")}
          />
        </div>

        {value.status !== "pending" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="payment-amount"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("amountPaid")}
              </label>
              <input
                id="payment-amount"
                type="text"
                inputMode="decimal"
                value={value.amountPaid}
                onChange={(e) =>
                  onChange({ ...value, amountPaid: e.target.value })
                }
                disabled={disabled}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="payment-method"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("method")}
              </label>
              <OptionSelect
                id="payment-method"
                value={value.method}
                options={METHODS.map((m) => ({ value: m, label: tMethods(m) }))}
                onChange={(method) => onChange({ ...value, method })}
                disabled={disabled}
                placeholder={t("methodPlaceholder")}
                ariaLabel={t("method")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
