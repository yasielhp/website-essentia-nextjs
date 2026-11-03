"use client";

import { useState } from "react";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const FIELDS: {
  key: Exclude<FieldKey, "consent">;
  type: string;
  auto: string;
}[] = [
  { key: "firstName", type: "text", auto: "given-name" },
  { key: "lastName", type: "text", auto: "family-name" },
  { key: "email", type: "email", auto: "email" },
  { key: "phone", type: "tel", auto: "tel" },
];

/**
 * The page where a bonus is paid for: what is being bought, who is buying, an
 * acceptance of the terms, and the way to the bank.
 *
 * The plan's id is all that goes to the server about what is being bought; the
 * price shown here is only a courtesy, the server charges the one it reads from
 * its own table.
 */
export function BonusCheckout({
  plan,
  backHref,
}: {
  plan: PublicBonusPlan;
  /** The treatment page this one belongs to; where "Back" goes. */
  backHref: string;
}) {
  const t = useTranslations("bonus.form");
  const tOffer = useTranslations("bonus.offer");
  const locale = useLocale() as SupportedLocale;

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

  return (
    <>
      <NextLink
        href={backHref}
        className="text-petroleum-400 hover:text-petroleum-700 mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft size={16} aria-hidden />
        {t("back")}
      </NextLink>

      <h1 className="font-display text-petroleum-700 mb-6 text-3xl md:text-4xl">
        {t("title")}
      </h1>

      <div className="border-sand-200 mb-6 flex flex-col gap-3 rounded-2xl border bg-white p-6">
        <div>
          <p className="font-display text-petroleum-700 text-2xl">
            {tOffer("sessions", { sessions: plan.sessions })}
          </p>
          <p className="text-petroleum-400 text-sm">{plan.tierLabel}</p>
        </div>
        <div className="border-sand-100 flex flex-col gap-1 border-t pt-3">
          <p className="text-petroleum-700 text-sm font-medium">
            {tOffer("total", { price: formatPrice(plan.priceEur, locale) })}
          </p>
          <p className="text-petroleum-500 text-sm">
            {tOffer("perSession", {
              price: formatPrice(plan.priceEur / plan.sessions, locale),
            })}
          </p>
          <p className="text-petroleum-400 text-xs">
            {tOffer("validity", { days: plan.validityDays })}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="border-sand-200 flex flex-col gap-4 rounded-2xl border bg-white p-6"
      >
        {FIELDS.map(({ key, type, auto }) => (
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

        <Button
          type="submit"
          variant="solid"
          size="lg"
          disabled={submitting}
          className="w-full"
        >
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </form>

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
