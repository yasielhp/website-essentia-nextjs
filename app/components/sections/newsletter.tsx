"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Checkbox } from "@components/ui/input";
import { Button } from "@components/ui/button";
import { Accordion } from "@components/ui/accordion";
import { contact } from "@/constants/contact";
import { subscribeToNewsletter } from "@/actions/newsletter";

// ─── Tema ─────────────────────────────────────────────────────

type Variant = "light" | "dark";

const theme = {
  light: {
    section: "bg-sand-100",
    heading: "text-petroleum-700",
    subheading: "text-petroleum-400",
    input:
      "border-petroleum-200 text-petroleum-700 placeholder:text-petroleum-400 focus:border-petroleum-500 focus:ring-petroleum-500/20",
    label: "text-petroleum-400",
    link: "text-petroleum-500 hover:text-petroleum-800",
    muted: "text-petroleum-400",
    accordion: "text-petroleum-400",
    button: "solid" as const,
  },
  dark: {
    section: "bg-petroleum-700",
    heading: "text-sand-50",
    subheading: "text-sand-500",
    input:
      "border-petroleum-500 text-sand-100 placeholder:text-sand-600 focus:border-sand-400 focus:ring-sand-400/20",
    label: "text-sand-500",
    link: "text-sand-300 hover:text-sand-100",
    muted: "text-sand-600",
    accordion: "text-sand-600",
    button: "outline-white" as const,
  },
};

// ─── Estado del formulario ────────────────────────────────────

type FormState = "idle" | "loading" | "success" | "error";
type FormErrors = { email?: string; consent?: string };

// ─── Componente ───────────────────────────────────────────────

type NewsletterProps = { variant?: Variant };

export default function Newsletter({ variant = "light" }: NewsletterProps) {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [state, setState] = useState<FormState>("idle");

  const t = useTranslations("common.newsletter");
  const th = theme[variant];

  function validate(emailVal: string, consentVal: boolean): FormErrors {
    const errs: FormErrors = {};
    if (!emailVal.trim()) {
      errs.email = t("emailValidationRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      errs.email = t("emailValidationInvalid");
    }
    if (!consentVal) {
      errs.consent = t("consentValidationRequired");
    }
    return errs;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationErrors = validate(email, consent);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setState("loading");
    try {
      const result = await subscribeToNewsletter(email);
      if (!result.ok) throw new Error(result.error);
      setSubmittedEmail(email);
      setState("success");
      setEmail("");
      setConsent(false);
    } catch {
      setState("error");
    }
  };

  return (
    <section className={`${th.section} w-full px-5 py-16 md:py-24`}>
      <div className="mx-auto max-w-4xl">
        {/* Cabecera */}
        <div className="mx-auto mb-10 max-w-lg text-center">
          <p
            className={`${th.heading} text-2xl font-medium text-balance md:text-3xl`}
          >
            {t("heading")}
          </p>
          <p className={`${th.subheading} mt-2 text-balance`}>
            {t("subheading")}
          </p>
        </div>

        {state === "success" ? (
          <div className="flex flex-col gap-1 text-center">
            <p className={`${th.heading} font-medium`}>{t("successHeading")}</p>
            <p className={`${th.subheading} text-sm`}>{t("successBody")}</p>
            <p className={`${th.muted} mt-3 text-xs`}>
              {t("successUnsubscribe")}{" "}
              <Link
                href={`/newsletter/unsubscribe?email=${encodeURIComponent(submittedEmail)}`}
                className={`${th.link} underline underline-offset-2 transition-colors`}
              >
                {t("unsubscribeLink")}
              </Link>
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mx-auto flex max-w-lg flex-col gap-5"
            aria-label="Newsletter subscription"
          >
            {/* Email */}
            <div>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email)
                    setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                disabled={state === "loading"}
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={`${errors.email ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : th.input} h-10 w-full rounded-full border bg-transparent px-5 py-2.5 text-sm transition-all duration-200 outline-none focus:ring-2 disabled:opacity-50`}
              />
              {errors.email && (
                <p
                  id="email-error"
                  className="mt-1.5 px-2 text-xs text-red-500"
                >
                  {errors.email}
                </p>
              )}
            </div>

            {/* Consentimiento explícito — RGPD art. 7 / LOPDGDD art. 6 */}
            <Checkbox
              name="consent"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (errors.consent)
                  setErrors((prev) => ({ ...prev, consent: undefined }));
              }}
              disabled={state === "loading"}
              error={errors.consent}
              label={
                <span className={th.label}>
                  {t("consentLabel")}{" "}
                  <Link
                    href="/privacy"
                    className={`${th.link} underline underline-offset-2 transition-colors duration-150`}
                    target="_blank"
                  >
                    {t("privacyPolicy")}
                  </Link>{" "}
                  {t("consentSuffix")}
                </span>
              }
            />

            <Button
              type="submit"
              variant={th.button}
              size="md"
              disabled={state === "loading"}
              aria-busy={state === "loading"}
              className="w-full"
            >
              {state === "loading" ? t("subscribing") : t("subscribe")}
            </Button>

            {/* Toggle de información RGPD art. 13 */}
            <Accordion className="border-sand-200 rounded-2xl border px-6">
              <Accordion.Header iconClassName={th.accordion}>
                <span
                  className={`${th.accordion} w-full text-center text-xs tracking-wide uppercase`}
                >
                  {t("dataProtectionToggle")}
                </span>
              </Accordion.Header>
              <Accordion.Content>
                <p className={`${th.muted} pb-3 text-xs leading-relaxed`}>
                  <strong className="font-medium">{t("dataController")}:</strong>{" "}
                  {t("dataControllerValue")} <br />
                  <strong className="font-medium">{t("dataPurpose")}:</strong>{" "}
                  {t("dataPurposeValue")} <br />
                  <strong className="font-medium">{t("dataLegalBasis")}:</strong>{" "}
                  {t("dataLegalBasisValue")} <br />
                  <strong className="font-medium">{t("dataRights")}:</strong>{" "}
                  {t("dataRightsValue")}{" "}
                  <a
                    href={`mailto:${contact.email}`}
                    className="underline underline-offset-2"
                  >
                    {contact.email}
                  </a>
                  . {t("dataFullDetails")}{" "}
                  <Link
                    href="/privacy"
                    className="underline underline-offset-2"
                    target="_blank"
                  >
                    {t("privacyPolicy")}
                  </Link>
                  .
                </p>
              </Accordion.Content>
            </Accordion>

            {state === "error" && (
              <p role="alert" className="text-xs text-red-500">
                {t("errorMessage")}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
