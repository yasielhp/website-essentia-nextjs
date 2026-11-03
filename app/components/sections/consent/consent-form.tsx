"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/ui/signature-pad";
import { Link } from "../../../../i18n/navigation";
import { INPUT_CLASS } from "@/constants/form-styles";
import { getAccessToken } from "@/lib/client-session";
import { submitConsent, submitConsentAsStaff } from "@/actions/consent";
import { CONSENT_FIELDS } from "@/lib/consent/fields";
import type { ConsentInput } from "@/lib/schemas";

/** Who is signing, as the page read it from their contact. */
export type ConsentSubject = {
  name: string;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
};

type Props =
  | { mode: "client"; token: string; subject: ConsentSubject }
  | {
      mode: "staff";
      contactId: string;
      subject: ConsentSubject;
      onSigned: () => void;
    };

const ERROR_KEYS = [
  "incomplete",
  "invalid",
  "tooLarge",
  "alreadySigned",
  "generic",
] as const;

/**
 * The informed-consent form, in the order of the centre's paper document:
 * personal data, health status, consent to treatment, health-data consent
 * (GDPR), image consent, and one signature that seals all of it.
 *
 * Used on the public link the client opens from their email, and inside the
 * contact's file so the desk can fill it in with them. Nothing is trusted from
 * here: the server validates the same rules again.
 */
export function ConsentForm(props: Props) {
  const t = useTranslations("consent");
  const { subject } = props;

  const [answers, setAnswers] = useState<Record<string, boolean | string>>({});
  const [avoidZone, setAvoidZone] = useState("");
  const [phone, setPhone] = useState(subject.phone ?? "");
  const [birthdate, setBirthdate] = useState(subject.birthdate ?? "");
  const [treatment, setTreatment] = useState(false);
  const [healthData, setHealthData] = useState(false);
  const [image, setImage] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const booleans = CONSENT_FIELDS.filter((f) => f.kind === "boolean");
  const allAnswered = booleans.every((f) => typeof answers[f.id] === "boolean");
  const complete =
    allAnswered &&
    treatment &&
    healthData &&
    signedName.trim().length >= 2 &&
    signature !== null &&
    birthdate !== "" &&
    phone.trim().length >= 6;

  function setAnswer(id: string, value: boolean | string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    if (!complete || !signature) return;
    setSubmitting(true);
    setError(null);

    const input: ConsentInput = {
      data: { ...answers, ...(avoidZone.trim() ? { avoidZone } : {}) },
      ...(birthdate && !subject.birthdate ? { birthdate } : {}),
      ...(phone.trim() && !subject.phone ? { phone: phone.trim() } : {}),
      treatmentAccepted: true,
      healthDataConsent: true,
      imageConsent: image,
      signedName: signedName.trim(),
      signaturePng: signature,
    };

    const result =
      props.mode === "client"
        ? await submitConsent(props.token, input)
        : await submitConsentAsStaff(getAccessToken(), props.contactId, input);
    setSubmitting(false);

    if (result.error) {
      const key = (ERROR_KEYS as readonly string[]).includes(result.error)
        ? result.error
        : "generic";
      setError(t(`errors.${key}`));
      return;
    }
    if (props.mode === "staff") props.onSigned();
    else setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="bg-petroleum-700 flex size-14 items-center justify-center rounded-full">
          <Check className="text-sand-50" size={26} strokeWidth={2.5} />
        </div>
        <h2 className="font-display text-petroleum-700 text-2xl">
          {t("done.title")}
        </h2>
        <p className="text-petroleum-400">{t("done.body")}</p>
      </div>
    );
  }

  const card =
    "border-sand-200 flex flex-col gap-4 rounded-2xl border bg-white p-6";
  const heading = "font-display text-petroleum-700 text-xl";
  const label = "text-petroleum-500 text-xs font-medium";

  return (
    <div className="flex flex-col gap-5">
      {/* Personal data */}
      <section className={card}>
        <h2 className={heading}>{t("personal.heading")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className={label}>{t("personal.name")}</span>
            <p className="text-petroleum-700 text-sm">{subject.name || "—"}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>{t("personal.email")}</span>
            <p className="text-petroleum-700 text-sm">{subject.email ?? "—"}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="consent-birthdate" className={label}>
              {t("personal.birthdate")}
            </label>
            <input
              id="consent-birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              readOnly={Boolean(subject.birthdate)}
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="consent-phone" className={label}>
              {t("personal.phone")}
            </label>
            <input
              id="consent-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              readOnly={Boolean(subject.phone)}
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </section>

      {/* Health status */}
      <section className={card}>
        <h2 className={heading}>{t("health.heading")}</h2>
        <p className="text-petroleum-400 text-sm">{t("health.intro")}</p>
        <div className="divide-sand-100 divide-y">
          {booleans.map((field) => {
            const value = answers[field.id];
            const detail = (answers[`${field.id}Detail`] as string) ?? "";
            return (
              <fieldset key={field.id} className="flex flex-col gap-2 py-3">
                <legend className="text-petroleum-700 float-left w-full text-sm">
                  {t(`fields.${field.id}`)}
                </legend>
                <div className="flex gap-2 pt-1">
                  {([true, false] as const).map((option) => (
                    <label
                      key={String(option)}
                      className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors ${
                        value === option
                          ? "border-petroleum-700 bg-petroleum-700 text-white"
                          : "border-sand-200 text-petroleum-500 hover:border-sand-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name={field.id}
                        checked={value === option}
                        onChange={() => setAnswer(field.id, option)}
                        disabled={submitting}
                        className="sr-only"
                      />
                      {option ? t("yes") : t("no")}
                    </label>
                  ))}
                </div>
                {value === true && (
                  <div className="flex flex-col gap-1">
                    <input
                      type="text"
                      value={detail}
                      maxLength={500}
                      onChange={(e) =>
                        setAnswer(`${field.id}Detail`, e.target.value)
                      }
                      placeholder={t(`fields.${field.id}Detail`)}
                      aria-label={t(`fields.${field.id}Detail`)}
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                    {!detail.trim() && (
                      <p className="text-xs text-amber-700">
                        {t("detailMissing")}
                      </p>
                    )}
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="consent-avoid" className={label}>
            {t("fields.avoidZone")} ({t("fields.avoidZoneHint")})
          </label>
          <textarea
            id="consent-avoid"
            value={avoidZone}
            maxLength={500}
            rows={2}
            onChange={(e) => setAvoidZone(e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS + " resize-none"}
          />
        </div>
      </section>

      {/* Treatment */}
      <section className={card}>
        <h2 className={heading}>{t("treatment.heading")}</h2>
        <p className="text-petroleum-500 text-sm leading-relaxed">
          {t("treatment.body")}
        </p>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={treatment}
            onChange={(e) => setTreatment(e.target.checked)}
            disabled={submitting}
            className="accent-petroleum-700 mt-0.5 size-4"
          />
          <span className="text-petroleum-700">{t("treatment.accept")}</span>
        </label>
      </section>

      {/* Health data (GDPR) */}
      <section className={card}>
        <h2 className={heading}>{t("healthData.heading")}</h2>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={healthData}
            onChange={(e) => setHealthData(e.target.checked)}
            disabled={submitting}
            className="accent-petroleum-700 mt-0.5 size-4"
          />
          <span className="text-petroleum-700">{t("healthData.accept")}</span>
        </label>
        <p className="text-petroleum-400 text-xs leading-relaxed">
          {t("healthData.controller")}{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="text-petroleum-500 underline"
          >
            {t("healthData.link")}
          </Link>
        </p>
      </section>

      {/* Image (optional, independent) */}
      <section className={card}>
        <h2 className={heading}>{t("image.heading")}</h2>
        <p className="text-petroleum-500 text-sm leading-relaxed">
          {t("image.body")}
        </p>
        <fieldset className="flex gap-2">
          <legend className="sr-only">{t("image.heading")}</legend>
          {([true, false] as const).map((option) => (
            <label
              key={String(option)}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors ${
                image === option
                  ? "border-petroleum-700 bg-petroleum-700 text-white"
                  : "border-sand-200 text-petroleum-500 hover:border-sand-500"
              }`}
            >
              <input
                type="radio"
                name="image-consent"
                checked={image === option}
                onChange={() => setImage(option)}
                disabled={submitting}
                className="sr-only"
              />
              {option ? t("image.yes") : t("image.no")}
            </label>
          ))}
        </fieldset>
      </section>

      {/* Name and signature */}
      <section className={card}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="consent-name" className={label}>
            {t("signedName")}
          </label>
          <input
            id="consent-name"
            type="text"
            value={signedName}
            maxLength={120}
            onChange={(e) => setSignedName(e.target.value)}
            autoComplete="name"
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>{t("signature")}</span>
          <SignaturePad
            onChange={setSignature}
            clearLabel={t("clear")}
            ariaLabel={t("signature")}
            disabled={submitting}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <Button
          variant="solid"
          size="lg"
          onClick={() => void handleSubmit()}
          disabled={!complete || submitting}
          className="w-full"
        >
          {submitting ? t("submitting") : t("submit")}
        </Button>
      </section>
    </div>
  );
}
