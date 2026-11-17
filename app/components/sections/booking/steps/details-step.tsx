"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useValidationMessage } from "@/hooks/use-validation-message";
import { Checkbox } from "@components/ui/input";
import { Accordion } from "@components/ui/accordion";
import { contact } from "@/constants/contact";
import type { DetailsState } from "@/types";
import type { Gender } from "@/types/person";
import { EmailInput } from "@/components/ui/email-input";
import { Field, inputClass, inputErr, inputOk } from "./field";

export type DetailsErrors = Partial<Record<keyof DetailsState, string>>;

export function DetailsStep({
  details,
  errors = {},
  onChange,
  onClearError,
  marketingOn = false,
}: {
  details: DetailsState;
  errors?: DetailsErrors;
  onChange: (d: DetailsState) => void;
  onClearError?: (key: keyof DetailsState) => void;
  /** A signed-in client already has news and offers on: shown ticked and left alone. */
  marketingOn?: boolean;
}) {
  const validationMessage = useValidationMessage();
  const t = useTranslations("booking.detailsStep");
  const set =
    (key: keyof DetailsState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...details, [key]: e.target.value });
      onClearError?.(key);
    };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label={t("firstName")}
          id="first-name"
          required
          error={errors.firstName}
        >
          <input
            id="first-name"
            type="text"
            autoComplete="given-name"
            placeholder={t("firstNamePlaceholder")}
            value={details.firstName}
            onChange={set("firstName")}
            className={`${inputClass} ${errors.firstName ? inputErr : inputOk}`}
          />
        </Field>
        <Field
          label={t("lastName")}
          id="last-name"
          required
          error={errors.lastName}
        >
          <input
            id="last-name"
            type="text"
            autoComplete="family-name"
            placeholder={t("lastNamePlaceholder")}
            value={details.lastName}
            onChange={set("lastName")}
            className={`${inputClass} ${errors.lastName ? inputErr : inputOk}`}
          />
        </Field>
      </div>
      <Field label={t("email")} id="email" required error={errors.email}>
        <EmailInput
          id="email"
          placeholder={t("emailPlaceholder")}
          value={details.email}
          onChange={(value) => {
            onChange({ ...details, email: value });
            onClearError?.("email");
          }}
          hasError={!!errors.email}
          className={`${inputClass} ${errors.email ? inputErr : inputOk}`}
        />
      </Field>
      <Field label={t("phone")} id="phone" required error={errors.phone}>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          value={details.phone}
          onChange={set("phone")}
          className={`${inputClass} ${errors.phone ? inputErr : inputOk}`}
        />
      </Field>
      <Field label={t("gender")} id="gender">
        <select
          id="gender"
          value={details.gender ?? ""}
          onChange={(e) => {
            onChange({
              ...details,
              gender: e.target.value as Gender | "",
            });
          }}
          className={`${inputClass} ${inputOk}`}
        >
          <option value="">{t("genderNotSpecified")}</option>
          <option value="female">{t("genderFemale")}</option>
          <option value="male">{t("genderMale")}</option>
          <option value="other">{t("genderOther")}</option>
        </select>
      </Field>
      <Field label={t("notes")} id="notes">
        <textarea
          id="notes"
          placeholder={t("notesPlaceholderShort")}
          value={details.notes ?? ""}
          rows={3}
          onChange={(e) => {
            onChange({ ...details, notes: e.target.value });
          }}
          className={`${inputClass} ${inputOk} resize-none`}
        />
      </Field>

      <div className="flex flex-col gap-1">
        <Checkbox
          name="consent"
          aria-required="true"
          checked={details.consent}
          onChange={(e) => {
            onChange({ ...details, consent: e.target.checked });
            onClearError?.("consent");
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
              {t("consentNoticeSuffix")}
              {/* The same red asterisk the required fields above carry (see
                  `Field`); decorative, since `aria-required` says it. */}
              <span aria-hidden="true" className="ml-0.5 text-red-400">
                *
              </span>
            </span>
          }
        />
        {errors.consent && (
          <p className="text-xs text-red-500">
            {validationMessage(errors.consent)}
          </p>
        )}
      </div>

      {/* The only box that is not required (the Terms box above carries the
          asterisk). Accepting the Terms and the Policy is what allows the
          confirmation and the reminder of the appointment, by email and
          WhatsApp; this one is marketing, a different question that the law
          wants asked apart, and it is ONE choice for both channels. It is never
          ticked for the visitor, and unticking it later does not withdraw a yes
          given before (unticked means "do not touch"): a withdrawal is the
          unsubscribe link in an email or a BAJA reply on WhatsApp. How to opt out
          is written in the data-protection panel and the Privacy Policy, not
          under the box, on purpose. A signed-in client who already has both
          channels on sees it ticked and locked. */}
      <Checkbox
        name="newsletter"
        checked={marketingOn || (details.newsletter ?? false)}
        disabled={marketingOn}
        onChange={(e) => {
          onChange({ ...details, newsletter: e.target.checked });
        }}
        label={
          <span className="text-petroleum-400 text-sm">
            {t("newsletterOptIn")}
            {marketingOn && (
              <span className="mt-0.5 block text-xs">
                {t("newsletterAlreadyOn")}
              </span>
            )}
          </span>
        }
      />

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
            <strong className="font-medium">{t("optOut")}</strong>{" "}
            {t("optOutValue")}
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
    </div>
  );
}
