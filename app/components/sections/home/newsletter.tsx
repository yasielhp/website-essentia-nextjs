"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Checkbox } from "@components/ui/input";
import { Button } from "@components/ui/button";
import { Accordion } from "@components/ui/accordion";
import { contact } from "@/constants/contact";

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
    link: "text-petroleum-600 hover:text-petroleum-800",
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

function validate(email: string, consent: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!consent) {
    errors.consent = "You must accept the privacy policy to subscribe.";
  }
  return errors;
}

// ─── Componente ───────────────────────────────────────────────

type NewsletterProps = { variant?: Variant };

export default function Newsletter({ variant = "light" }: NewsletterProps) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [state, setState] = useState<FormState>("idle");

  const t = theme[variant];

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
      // TODO: conectar con el endpoint real de suscripción
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setState("success");
      setEmail("");
      setConsent(false);
    } catch {
      setState("error");
    }
  };

  return (
    <section className={`${t.section} w-full px-5 py-16 md:py-24`}>
      <div className="mx-auto max-w-4xl">
        {/* Cabecera */}
        <div className="mx-auto mb-10 max-w-lg text-center">
          <p
            className={`${t.heading} text-2xl font-medium text-balance md:text-3xl`}
          >
            Intelligence for those who take their health seriously.
          </p>
          <p className={`${t.subheading} mt-2 text-balance`}>
            Protocols, insights, and community updates — sent when it&apos;s
            worth your attention.
          </p>
        </div>

        {state === "success" ? (
          <div className="flex flex-col gap-1 text-center">
            <p className={`${t.heading} font-medium`}>You&apos;re in.</p>
            <p className={`${t.subheading} text-sm`}>
              Confirm your address via the email we just sent. You can leave
              whenever you like.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mx-auto flex max-w-lg flex-col gap-5"
            aria-label="Newsletter subscription"
          >
            {/* Email + botón en línea */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Your email address"
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
                  className={`${errors.email ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : t.input} h-10 w-full rounded-full border bg-transparent px-5 py-2.5 text-sm transition-all duration-200 outline-none focus:ring-2 disabled:opacity-50`}
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
              <Button
                type="submit"
                variant={t.button}
                size="md"
                disabled={state === "loading"}
                aria-busy={state === "loading"}
                className="shrink-0"
              >
                {state === "loading" ? "Subscribing…" : "Subscribe"}
              </Button>
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
                <span className={t.label}>
                  I agree to the{" "}
                  <Link
                    href="/privacy"
                    className={`${t.link} underline underline-offset-2 transition-colors duration-150`}
                    target="_blank"
                  >
                    Privacy Policy
                  </Link>{" "}
                  and consent to receive Essentia&apos;s newsletter.
                </span>
              }
            />

            {/* Toggle de información RGPD art. 13 */}
            <Accordion className="border-none">
              <Accordion.Header iconClassName={t.accordion}>
                <span className={`${t.accordion} text-xs`}>
                  Data protection information
                </span>
              </Accordion.Header>
              <Accordion.Content>
                <p className={`${t.muted} pb-3 text-xs leading-relaxed`}>
                  <strong className="font-medium">Data controller:</strong>{" "}
                  Essentia Social Wellness Club <br />
                  <strong className="font-medium">Purpose:</strong> sending our
                  newsletter <br />
                  <strong className="font-medium">Legal basis:</strong> your
                  consent (GDPR art. 6.1.a) <br />
                  <strong className="font-medium">Your rights:</strong> access,
                  rectification, erasure, restriction, portability, and
                  objection — write to{" "}
                  <a
                    href={`mailto:${contact.email}`}
                    className="underline underline-offset-2"
                  >
                    {contact.email}
                  </a>
                  . Full details in our{" "}
                  <Link
                    href="/privacy"
                    className="underline underline-offset-2"
                    target="_blank"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </Accordion.Content>
            </Accordion>

            {state === "error" && (
              <p role="alert" className="text-xs text-red-500">
                Something went wrong. Please try again later.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
