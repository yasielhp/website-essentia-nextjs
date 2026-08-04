"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@components/ui/input";
import { Accordion } from "@components/ui/accordion";
import { submitReview } from "@/actions/submit-review";
import { INPUT_CLASS, TEXTAREA_CLASS } from "@/constants/form-styles";
import { contact } from "@/constants/contact";

export default function NewReviewPage() {
  const t = useTranslations("reviews.new");
  const locale = useLocale();
  const reviewsHref = locale === "es" ? "/es/testimonios" : "/reviews";
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!consent) {
      setConsentError(t("consentError"));
      return;
    }
    setConsentError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await submitReview(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  if (success) {
    return (
      <div className="bg-sand-100 min-h-screen px-6 pt-48 pb-20 text-center lg:px-10 lg:pt-60">
        <div className="mx-auto max-w-xl">
          <p className="font-display text-petroleum-700 mb-3 text-4xl">
            {t("successHeadline")}
          </p>
          <p className="text-petroleum-400 mb-8 text-base">
            {t("successBody")}
          </p>
          <Button variant="solid" size="md" href={reviewsHref}>
            {t("seeAllReviews")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-sand-100 min-h-screen px-6 pt-32 pb-20 lg:px-10 lg:pt-44">
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-petroleum-700 mb-10 text-4xl sm:text-5xl">
          {t("headline")}
        </h1>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-5"
        >
          {error && (
            <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="text-petroleum-500 text-sm font-medium"
            >
              {t("nameLabel")} <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder={t("namePlaceholder")}
              disabled={isPending}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="age"
              className="text-petroleum-500 text-sm font-medium"
            >
              {t("ageLabel")} <span className="text-red-400">*</span>
            </label>
            <input
              id="age"
              name="age"
              type="number"
              min={1}
              max={120}
              required
              placeholder={t("agePlaceholder")}
              disabled={isPending}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="quote"
              className="text-petroleum-500 text-sm font-medium"
            >
              {t("quoteLabel")} <span className="text-red-400">*</span>
            </label>
            <textarea
              id="quote"
              name="quote"
              required
              rows={5}
              placeholder={t("quotePlaceholder")}
              disabled={isPending}
              className={TEXTAREA_CLASS}
            />
          </div>

          {/* Consent */}
          <div className="flex flex-col gap-1">
            <Checkbox
              name="consent"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) setConsentError(null);
              }}
              label={
                <span className="text-petroleum-400 text-sm">
                  {t("consentPrefix")}{" "}
                  <Link
                    href="/terms"
                    className="text-petroleum-500 hover:text-petroleum-700 underline underline-offset-2 transition-colors"
                    target="_blank"
                  >
                    {t("terms")}
                  </Link>{" "}
                  {t("consentAnd")}{" "}
                  <Link
                    href="/privacy"
                    className="text-petroleum-500 hover:text-petroleum-700 underline underline-offset-2 transition-colors"
                    target="_blank"
                  >
                    {t("privacyPolicy")}
                  </Link>
                  {t("consentSuffix")}
                </span>
              }
            />
            {consentError && (
              <p className="text-xs text-red-500">{consentError}</p>
            )}
          </div>

          {/* Data protection accordion */}
          <Accordion className="border-sand-500 rounded-2xl border px-6">
            <Accordion.Header iconClassName="text-petroleum-400">
              <span className="text-petroleum-400 w-full text-center text-xs tracking-wide uppercase">
                {t("dataProtectionTitle")}
              </span>
            </Accordion.Header>
            <Accordion.Content>
              <p className="text-petroleum-400 pb-3 text-xs leading-relaxed">
                <strong className="font-medium">{t("dataController")}</strong>{" "}
                {t("dataControllerValue")}
                <br />
                <strong className="font-medium">{t("purpose")}</strong>{" "}
                {t("purposeValue")}
                <br />
                <strong className="font-medium">{t("legalBasis")}</strong>{" "}
                {t("legalBasisValue")}
                <br />
                <strong className="font-medium">{t("rights")}</strong>{" "}
                {t("rightsValue")}{" "}
                <a
                  href={`mailto:${contact.email}`}
                  className="underline underline-offset-2"
                >
                  {contact.email}
                </a>
                . {t("fullDetails")}{" "}
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

          <Button
            type="submit"
            variant="solid"
            size="md"
            disabled={isPending}
            className="self-start"
          >
            {isPending ? t("submitting") : t("submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
