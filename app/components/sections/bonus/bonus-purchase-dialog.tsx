"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconX } from "@/components/ui/icons";
import { INPUT_CLASS } from "@/constants/form-styles";
import { Link } from "../../../../i18n/navigation";
import { isValidPhone } from "@/utils/contact";
import { formatPrice, type SupportedLocale } from "@/utils/format";
import {
  PaymentOverlay,
  type RedsysFormData,
} from "@/components/sections/booking/steps/payment-overlay";
import type { PublicBonusPlan } from "@/types/bonus";

type FieldKey = "firstName" | "lastName" | "email" | "phone" | "consent";

/**
 * Buying a bonus: who is buying, an acceptance of the terms, and the payment.
 *
 * The plan's id is all that goes to the server about what is being bought; the
 * price shown here is only a courtesy, the server charges the one it reads from
 * its own table.
 */
export function BonusPurchaseDialog({
  plan,
  onClose,
}: {
  plan: PublicBonusPlan;
  onClose: () => void;
}) {
  const t = useTranslations("bonus.form");
  const locale = useLocale() as SupportedLocale;
  const overlayRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [redsysForm, setRedsysForm] = useState<RedsysFormData | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function validate(): Partial<Record<FieldKey, string>> {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!values.firstName.trim()) next.firstName = t("errors.firstName");
    if (!values.lastName.trim()) next.lastName = t("errors.lastName");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = t("errors.email");
    }
    if (!isValidPhone(values.phone)) next.phone = t("errors.phone");
    if (!consent) next.consent = t("errors.consent");
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setGeneralError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/bonus-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          consent: true,
          locale,
        }),
      });
      if (!res.ok) throw new Error("checkout failed");
      setRedsysForm((await res.json()) as RedsysFormData);
    } catch {
      setGeneralError(t("errors.generic"));
      setSubmitting(false);
    }
  }

  const fields: {
    key: Exclude<FieldKey, "consent">;
    type: string;
    auto: string;
  }[] = [
    { key: "firstName", type: "text", auto: "given-name" },
    { key: "lastName", type: "text", auto: "family-name" },
    { key: "email", type: "email", auto: "email" },
    { key: "phone", type: "tel", auto: "tel" },
  ];

  return (
    <>
      <div
        ref={overlayRef}
        role="presentation"
        onClick={(e) => {
          if (e.target === overlayRef.current && !submitting) onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-5 py-8"
      >
        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          role="dialog"
          aria-modal="true"
          aria-label={t("title")}
          className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-petroleum-700 text-2xl">
                {t("title")}
              </h3>
              <p className="text-petroleum-400 mt-1 text-sm">
                {t("summary", {
                  sessions: plan.sessions,
                  service: plan.tierLabel,
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label={t("close")}
              className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
            >
              <IconX />
            </button>
          </div>

          {fields.map(({ key, type, auto }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label
                htmlFor={`bonus-${key}`}
                className="text-petroleum-500 text-xs font-medium"
              >
                {t(key)}
              </label>
              <input
                id={`bonus-${key}`}
                type={type}
                autoComplete={auto}
                value={values[key]}
                maxLength={key === "email" ? 160 : 80}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [key]: e.target.value }))
                }
                disabled={submitting}
                aria-invalid={Boolean(errors[key])}
                className={INPUT_CLASS}
              />
              {errors[key] && (
                <p className="text-xs text-red-600">{errors[key]}</p>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={submitting}
                className="accent-petroleum-700 mt-0.5 size-4"
              />
              <span className="text-petroleum-700">
                {t.rich("terms", {
                  link: (chunks) => (
                    <Link
                      href="/terms"
                      target="_blank"
                      className="text-petroleum-500 underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </label>
            {errors.consent && (
              <p className="text-xs text-red-600">{errors.consent}</p>
            )}
          </div>

          <p className="text-petroleum-400 text-xs leading-relaxed">
            {t("pay", { price: formatPrice(plan.priceEur, locale) })}
          </p>

          {generalError && (
            <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
              {generalError}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              variant="solid"
              size="lg"
              disabled={submitting}
              className="w-full"
            >
              {submitting ? t("submitting") : t("submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={submitting}
              className="w-full"
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </div>

      {redsysForm && (
        <PaymentOverlay
          formData={redsysForm}
          onClose={() => {
            setRedsysForm(null);
            setSubmitting(false);
          }}
        />
      )}
    </>
  );
}
