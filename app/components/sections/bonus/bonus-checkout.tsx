"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Checkbox } from "@components/ui/input";
import { EmailInput } from "@/components/ui/email-input";
import { StepNavigation } from "@/components/ui/step-navigation";
import {
  Field,
  inputClass,
  inputErr,
  inputOk,
} from "@/components/sections/booking/steps/field";
import { StepIndicator } from "@/components/sections/booking/steps/step-indicator";
import {
  PaymentOverlay,
  type RedsysFormData,
} from "@/components/sections/booking/steps/payment-overlay";
import { useValidationMessage } from "@/hooks/use-validation-message";
import {
  bonusConsentSchema,
  bonusDetailsSchema,
  parseErrors,
} from "@/lib/schemas";
import {
  readBuyer,
  writeBuyer,
  type BuyerDraft,
} from "@/lib/bonuses/buyer-storage";
import { bonusCheckoutHref, type BonusFamily } from "@/lib/bonuses/routes";
import { formatPrice, type SupportedLocale } from "@/utils/format";
import type { PublicBonusPlan } from "@/types/bonus";

type Errors = Partial<Record<keyof BuyerDraft | "consent", string>>;

const STEP_IDS = ["plan", "details", "confirm"] as const;

/**
 * Buying a bonus, one step at a time, the way a booking is made: pick the
 * bonus, say who you are, confirm and pay.
 *
 * It arrives on the second step with the bonus from the URL already chosen —
 * the step is resolved, and "back" reopens it. Changing the bonus rewrites the
 * URL in place (the browser's own history API, so nothing reloads) so a refresh
 * keeps the choice. Who the buyer is survives a reload in the browser; nothing
 * about the payment does. The server charges the plan's own price, whatever
 * this page shows.
 */
export function BonusCheckout({
  plans,
  initialPlanId,
  family,
  slug,
}: {
  /** The bonuses on sale for this treatment. */
  plans: PublicBonusPlan[];
  initialPlanId: string;
  family: BonusFamily;
  slug: string;
}) {
  const t = useTranslations("bonus");
  const tOffer = useTranslations("bonus.offer");
  const tNav = useTranslations("booking.nav");
  const tDetails = useTranslations("booking.detailsStep");
  const locale = useLocale() as SupportedLocale;
  const validationMessage = useValidationMessage();

  const [step, setStep] = useState(1);
  const [planId, setPlanId] = useState(initialPlanId);
  // Read once, on the first render: this component only ever runs in the
  // browser (see `BonusCheckoutStepper`), so storage is there.
  const [buyer, setBuyer] = useState<BuyerDraft>(readBuyer);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [redsysForm, setRedsysForm] = useState<RedsysFormData | null>(null);

  useEffect(() => {
    writeBuyer(buyer);
  }, [buyer]);

  const plan = plans.find((p) => p.id === planId) ?? plans[0]!;
  const currentStepId = STEP_IDS[step]!;
  const steps = STEP_IDS.map((id) => ({ id, label: t(`steps.${id}`) }));
  const isLastStep = step === STEP_IDS.length - 1;
  const nextLabel = steps[step + 1]?.label;

  function choosePlan(id: string) {
    setPlanId(id);
    // Same page, new bonus: the address follows without a reload.
    window.history.replaceState(
      null,
      "",
      bonusCheckoutHref(locale, family, slug, id),
    );
  }

  function setField(key: keyof BuyerDraft, value: string) {
    setBuyer((b) => ({ ...b, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function next() {
    if (currentStepId === "details") {
      const found = parseErrors(bonusDetailsSchema, buyer);
      setErrors(found);
      if (Object.keys(found).length > 0) return;
    }
    setStep((s) => s + 1);
  }

  async function pay() {
    const found = parseErrors(bonusConsentSchema, { consent });
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
          firstName: buyer.firstName.trim(),
          lastName: buyer.lastName.trim(),
          email: buyer.email.trim(),
          phone: buyer.phone.trim(),
          consent: true,
          locale,
        }),
      });
      if (!res.ok) throw new Error("checkout failed");
      setRedsysForm((await res.json()) as RedsysFormData);
    } catch {
      setGeneralError(t("form.errors.generic"));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator current={step} steps={steps} />

      {currentStepId === "plan" && (
        <div className="flex flex-col gap-3">
          <p className="text-petroleum-700 text-sm font-medium">
            {t("planStep.heading")}
          </p>
          <ul className="flex flex-col gap-3">
            {plans.map((p) => {
              const selected = p.id === plan.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => choosePlan(p.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-5 text-left transition-colors ${
                      selected
                        ? "border-petroleum-700 bg-sand-50"
                        : "border-sand-200 hover:border-sand-500 bg-white"
                    }`}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-display text-petroleum-700 text-2xl">
                        {tOffer("sessions", { sessions: p.sessions })}
                      </span>
                      <span className="text-petroleum-500 text-sm">
                        {tOffer("perSession", {
                          price: formatPrice(p.priceEur / p.sessions, locale),
                        })}
                      </span>
                      <span className="text-petroleum-400 text-xs">
                        {tOffer("validity", { days: p.validityDays })}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-petroleum-700 text-sm font-medium">
                        {formatPrice(p.priceEur, locale)}
                      </span>
                      {selected && (
                        <Check
                          size={16}
                          className="text-petroleum-700"
                          aria-hidden
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {currentStepId === "details" && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label={tDetails("firstName")}
              id="first-name"
              required
              error={errors.firstName}
            >
              <input
                id="first-name"
                type="text"
                autoComplete="given-name"
                placeholder={tDetails("firstNamePlaceholder")}
                maxLength={80}
                value={buyer.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className={`${inputClass} ${errors.firstName ? inputErr : inputOk}`}
              />
            </Field>
            <Field
              label={tDetails("lastName")}
              id="last-name"
              required
              error={errors.lastName}
            >
              <input
                id="last-name"
                type="text"
                autoComplete="family-name"
                placeholder={tDetails("lastNamePlaceholder")}
                maxLength={80}
                value={buyer.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className={`${inputClass} ${errors.lastName ? inputErr : inputOk}`}
              />
            </Field>
          </div>
          <Field
            label={tDetails("email")}
            id="email"
            required
            error={errors.email}
          >
            <EmailInput
              id="email"
              placeholder={tDetails("emailPlaceholder")}
              maxLength={160}
              value={buyer.email}
              onChange={(value) => setField("email", value)}
              hasError={!!errors.email}
              className={`${inputClass} ${errors.email ? inputErr : inputOk}`}
            />
          </Field>
          <Field
            label={tDetails("phone")}
            id="phone"
            required
            error={errors.phone}
          >
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder={tDetails("phonePlaceholder")}
              maxLength={30}
              value={buyer.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className={`${inputClass} ${errors.phone ? inputErr : inputOk}`}
            />
          </Field>
        </div>
      )}

      {currentStepId === "confirm" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-6">
            <div>
              <p className="text-petroleum-400 text-xs tracking-wider uppercase">
                {plan.tierLabel}
              </p>
              <p className="font-display text-petroleum-700 text-2xl">
                {tOffer("sessions", { sessions: plan.sessions })}
              </p>
            </div>
            <div className="border-sand-100 flex flex-col gap-2 border-t pt-4 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-petroleum-400">
                  {t("confirmStep.perSession")}
                </span>
                <span className="text-petroleum-700">
                  {formatPrice(plan.priceEur / plan.sessions, locale)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-petroleum-400">
                  {t("confirmStep.validity")}
                </span>
                <span className="text-petroleum-700">
                  {t("confirmStep.validityDays", { days: plan.validityDays })}
                </span>
              </div>
              <div className="border-sand-100 flex items-baseline justify-between border-t pt-2">
                <span className="text-petroleum-700 font-medium">
                  {t("confirmStep.total")}
                </span>
                <span className="font-display text-petroleum-700 text-xl">
                  {formatPrice(plan.priceEur, locale)}
                </span>
              </div>
            </div>
            <div className="border-sand-100 flex flex-col gap-1 border-t pt-4">
              <Checkbox
                name="consent"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setErrors((prev) => ({ ...prev, consent: undefined }));
                }}
                label={
                  <span className="text-petroleum-400 text-sm">
                    {tDetails("consentPrefix")}{" "}
                    <NextLink
                      href="/terms"
                      className="text-petroleum-500 hover:text-petroleum-700 underline underline-offset-2 transition-colors"
                      target="_blank"
                    >
                      {tDetails("terms")}
                    </NextLink>{" "}
                    {tDetails("consentAnd")}{" "}
                    <NextLink
                      href="/privacy"
                      className="text-petroleum-500 hover:text-petroleum-700 underline underline-offset-2 transition-colors"
                      target="_blank"
                    >
                      {tDetails("privacyPolicy")}
                    </NextLink>
                    {tDetails("consentSuffix")}
                  </span>
                }
              />
              {errors.consent && (
                <p className="text-xs text-red-500">
                  {validationMessage(errors.consent)}
                </p>
              )}
            </div>
          </div>

          {generalError && (
            <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
              {generalError}
            </p>
          )}
        </div>
      )}

      <StepNavigation
        step={step}
        isLastStep={isLastStep}
        loading={submitting}
        checking={false}
        canProceed
        onBack={() => setStep((s) => s - 1)}
        onNext={next}
        onConfirm={() => void pay()}
        labels={{
          back: tNav("back"),
          next: nextLabel
            ? tNav("nextWithLabel", { label: nextLabel })
            : tNav("nextStep"),
          checking: tNav("checking"),
          confirm: t("form.submit"),
          confirming: t("form.submitting"),
        }}
      />

      {redsysForm && (
        <PaymentOverlay
          formData={redsysForm}
          onClose={() => {
            setRedsysForm(null);
            setSubmitting(false);
          }}
        />
      )}
    </div>
  );
}
