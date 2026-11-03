"use client";

import { useTranslations } from "next-intl";
import { shortDate } from "./consent-date";
import { CONSENT_FIELDS } from "@/lib/consent/fields";
import type { ContactConsent } from "@/types/consent";

/**
 * A signed consent as the therapist reads it: it opens with when it was signed,
 * then one line per point, the text on
 * the left and Yes or No on the right, with a rule above every line. A yes to
 * a health question is flagged in amber. The signature itself is not drawn
 * here; the line only says whether there is one.
 */
export function ConsentView({ consent }: { consent: ContactConsent }) {
  const t = useTranslations("dashboard.contacts.detail.consent");
  const tForm = useTranslations("consent");

  const answered = CONSENT_FIELDS.filter((f) => f.kind === "boolean");
  const avoidZone =
    typeof consent.answers.avoidZone === "string"
      ? consent.answers.avoidZone.trim()
      : "";

  const yes = tForm("yes");
  const no = tForm("no");

  return (
    <div>
      <Line
        label={t("signedLabel")}
        value={consent.signedAt ? shortDate(consent.signedAt) : "—"}
      />
      {answered.map((field) => {
        const isYes = consent.answers[field.id] === true;
        const detail = consent.answers[`${field.id}Detail`];
        return (
          <Line
            key={field.id}
            label={tForm(`fields.${field.id}`)}
            note={typeof detail === "string" ? detail : undefined}
            value={isYes ? yes : no}
            flagged={isYes}
          />
        );
      })}

      <Line
        label={tForm("fields.avoidZone")}
        value={avoidZone || "—"}
        flagged={avoidZone !== ""}
      />
      <Line label={tForm("treatment.accept")} value={yes} />
      <Line
        label={tForm("healthData.accept")}
        value={consent.healthDataConsent ? yes : no}
      />
      <Line
        label={tForm("image.heading")}
        value={consent.imageConsent ? yes : no}
      />
      <Line
        label={tForm("signature")}
        value={consent.signatureDataUrl ? yes : no}
      />
    </div>
  );
}

/** One point of the consent. The rule is above, so every line has one. */
function Line({
  label,
  note,
  value,
  flagged = false,
}: {
  label: string;
  /** Free text the client added to a yes: which operation, since when. */
  note?: string;
  value: string;
  flagged?: boolean;
}) {
  return (
    <div
      className={`border-sand-100 flex items-start justify-between gap-6 border-t px-2 py-3 text-sm ${
        flagged ? "bg-amber-50" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-petroleum-700">{label}</p>
        {note && <p className="text-petroleum-500 mt-0.5 text-xs">{note}</p>}
      </div>
      <p
        className={`max-w-[50%] shrink-0 text-right font-medium ${
          flagged ? "text-amber-800" : "text-petroleum-400"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
