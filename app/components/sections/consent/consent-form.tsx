"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/ui/signature-pad";
import { OptionSelect } from "@/components/ui/option-select";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { INPUT_CLASS } from "@/constants/form-styles";
import { getAccessToken } from "@/lib/client-session";
import { submitConsent, submitConsentAsStaff } from "@/actions/consent";
import { CONSENT_FIELDS } from "@/lib/consent/fields";
import { canSubmitConsent } from "@/lib/consent/signature";
import type { ConsentInput } from "@/lib/schemas";

/** Who is signing, as the page read it from their contact. */
export type ConsentSubject = {
  name: string;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
};

/**
 * Earlier answers to start from. The signature comes along only to be shown:
 * when a signed consent is corrected it stays on record unless a new one is
 * drawn, and it is never pre-drawn on the canvas.
 */
export type ConsentInitial = {
  answers: Record<string, boolean | string>;
  imageConsent: boolean;
  healthDataConsent: boolean;
  /** The signature on record, as a data URL, when there is one to keep. */
  signatureDataUrl?: string | null;
};

type Props =
  | { mode: "client"; token: string; subject: ConsentSubject }
  | {
      mode: "staff";
      contactId: string;
      subject: ConsentSubject;
      onSigned: () => void;
      /** Pre-fills the form, for correcting or renewing a consent. */
      initial?: ConsentInitial;
      /** The consent being edited is already signed: this replaces it. */
      replace?: boolean;
      /** Leaves the form without saving anything. */
      onCancel?: () => void;
    };

const ERROR_KEYS = [
  "incomplete",
  "invalid",
  "tooLarge",
  "alreadySigned",
  "conflict",
  "generic",
] as const;

/**
 * The informed-consent form, in the order of the centre's paper document:
 * health status, consent to treatment, health-data consent (GDPR), image
 * consent, and one signature that seals all of it. The personal data the paper
 * form opens with is not asked again: it already lives in the contact's
 * details tab.
 *
 * Used on the public link the client opens from their email, and inside the
 * contact's file so the desk can fill it in with them. Nothing is trusted from
 * here: the server validates the same rules again.
 */
export function ConsentForm(props: Props) {
  const t = useTranslations("consent");
  const locale = useLocale();
  const { subject } = props;
  // The birthdate is asked only when the contact has none: the server fills
  // what is missing and never overwrites what the centre already has.
  const hasBirthdate = Boolean(subject.birthdate);
  const [birthdate, setBirthdate] = useState(subject.birthdate ?? "");
  // Only the desk may start from earlier answers; the public link starts blank.
  const initial = props.mode === "staff" ? props.initial : undefined;

  const [answers, setAnswers] = useState<Record<string, boolean | string>>(
    () => {
      if (!initial) return {};
      const rest = { ...initial.answers };
      delete rest.avoidZone;
      return rest;
    },
  );
  const [avoidZone, setAvoidZone] = useState(
    typeof initial?.answers.avoidZone === "string"
      ? initial.answers.avoidZone
      : "",
  );
  // Signed before means the treatment was accepted before; the client still
  // signs again to confirm it.
  const [treatment, setTreatment] = useState(Boolean(initial));
  const [healthData, setHealthData] = useState(
    initial?.healthDataConsent ?? false,
  );
  const [image, setImage] = useState(initial?.imageConsent ?? false);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const booleans = CONSENT_FIELDS.filter((f) => f.kind === "boolean");
  const allAnswered = booleans.every((f) => typeof answers[f.id] === "boolean");
  // What it takes to send, by mode. Always: the 13 answers and the treatment and
  // health-data switches. A first signing, and the public link, also need a
  // drawn signature. Correcting a signed consent shows the one on record inside
  // the box and keeps it (`keepCurrent`) until it is erased or drawn over; once
  // it is, a signature is needed like the first time.
  const recordedSignature =
    props.mode === "staff" && props.replace
      ? (initial?.signatureDataUrl ?? null)
      : null;
  const replacingSigned = props.mode === "staff" && Boolean(props.replace);
  const [keepCurrent, setKeepCurrent] = useState(recordedSignature !== null);
  const complete = canSubmitConsent({
    allAnswered,
    treatmentAccepted: treatment,
    healthDataAccepted: healthData,
    drewSignature: signature !== null,
    keepingSignature: keepCurrent,
  });

  const signerName =
    subject.name?.trim() || subject.email?.trim() || t("signerFallback");

  function setAnswer(id: string, value: boolean | string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    if (!complete) return;
    setSubmitting(true);
    setError(null);

    const input: ConsentInput = {
      data: { ...answers, ...(avoidZone.trim() ? { avoidZone } : {}) },
      treatmentAccepted: true,
      healthDataConsent: true,
      imageConsent: image,
      // The name is not asked again: it is the one already on the contact.
      signedName: signerName,
      ...(!hasBirthdate && /^\d{4}-\d{2}-\d{2}$/.test(birthdate)
        ? { birthdate }
        : {}),
      ...(signature ? { signaturePng: signature } : {}),
    };

    const result =
      props.mode === "client"
        ? await submitConsent(props.token, input)
        : await submitConsentAsStaff(
            getAccessToken(),
            props.contactId,
            input,
            props.replace ? { replace: true } : undefined,
          );
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
      {/* Who signs: the name from the contact, and the birthdate when the
          contact has none yet. */}
      <section className={card}>
        <h2 className={heading}>{t("person.heading")}</h2>
        <div className="flex flex-col gap-1.5">
          <span className={label}>{t("person.name")}</span>
          <p className="text-petroleum-700 text-sm">{signerName}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {hasBirthdate ? (
            <span className={label}>{t("person.birthdate")}</span>
          ) : (
            <label htmlFor="consent-birthdate" className={label}>
              {t("person.birthdate")}
            </label>
          )}
          {hasBirthdate ? (
            <p className="text-petroleum-700 text-sm">
              {new Date(`${subject.birthdate}T00:00:00`).toLocaleDateString(
                locale,
                { day: "numeric", month: "long", year: "numeric" },
              )}
            </p>
          ) : (
            <>
              <input
                id="consent-birthdate"
                type="date"
                value={birthdate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setBirthdate(e.target.value)}
                disabled={submitting}
                className={INPUT_CLASS}
              />
              <p className="text-petroleum-400 text-xs">
                {t("person.birthdateHint")}
              </p>
            </>
          )}
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
                <div className="flex flex-col gap-2">
                  <legend className="text-petroleum-700 float-left w-full text-sm">
                    {t(`fields.${field.id}`)}
                  </legend>
                  <div className="w-full">
                    <OptionSelect<"yes" | "no" | "">
                      ariaLabel={t(`fields.${field.id}`)}
                      placeholder={t("select")}
                      disabled={submitting}
                      value={
                        value === true ? "yes" : value === false ? "no" : ""
                      }
                      options={[
                        { value: "no", label: t("no") },
                        { value: "yes", label: t("yes") },
                      ]}
                      onChange={(v) => {
                        if (v) setAnswer(field.id, v === "yes");
                      }}
                    />
                  </div>
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
        <ToggleRow
          checked={treatment}
          onToggle={() => setTreatment((v) => !v)}
          label={t("treatment.accept")}
          disabled={submitting}
        />
      </section>

      {/* Health data (GDPR) */}
      <section className={card}>
        <h2 className={heading}>{t("healthData.heading")}</h2>
        <ToggleRow
          checked={healthData}
          onToggle={() => setHealthData((v) => !v)}
          label={t("healthData.accept")}
          disabled={submitting}
        />
      </section>

      {/* Image (optional, independent) */}
      <section className={card}>
        <h2 className={heading}>{t("image.heading")}</h2>
        <p className="text-petroleum-500 text-sm leading-relaxed">
          {t("image.body")}
        </p>
        <OptionSelect<"yes" | "no">
          ariaLabel={t("image.heading")}
          disabled={submitting}
          value={image ? "yes" : "no"}
          options={[
            { value: "yes", label: t("image.yes") },
            { value: "no", label: t("image.no") },
          ]}
          onChange={(v) => setImage(v === "yes")}
        />
      </section>

      {/* Signature */}
      <section className={card}>
        <div className="flex flex-col gap-1.5">
          <span className={label}>{t("signature")}</span>
          <SignaturePad
            onChange={setSignature}
            initialImage={recordedSignature}
            onInitialCleared={() => setKeepCurrent(false)}
            clearLabel={t("clear")}
            ariaLabel={t("signature")}
            expandLabel={t("signatureExpand")}
            doneLabel={t("signatureDone")}
            closeLabel={t("signatureClose")}
            disabled={submitting}
          />
          {keepCurrent && (
            <p className="text-petroleum-400 text-xs">{t("signatureKept")}</p>
          )}
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
          {/* Correcting a signed consent saves it; signing for the first time,
              or from the public link, sends it. */}
          {replacingSigned
            ? submitting
              ? t("saving")
              : t("save")
            : submitting
              ? t("submitting")
              : t("submit")}
        </Button>
        {props.mode === "staff" && props.onCancel && (
          <Button
            variant="outline"
            size="lg"
            onClick={props.onCancel}
            disabled={submitting}
            className="w-full"
          >
            {t("cancel")}
          </Button>
        )}
      </section>
    </div>
  );
}
