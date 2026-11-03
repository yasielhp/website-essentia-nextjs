"use client";

import { useTranslations } from "next-intl";
import { CONSENT_FIELDS } from "@/lib/consent/fields";
import type { ContactConsent } from "@/types/consent";

/**
 * A signed consent as the therapist reads it: every answer, flagged in amber
 * where it was a yes, the zone to avoid, what was accepted, and the signature.
 */
export function ConsentView({ consent }: { consent: ContactConsent }) {
  const t = useTranslations("dashboard.contacts.detail.consent");
  const tForm = useTranslations("consent");

  const answered = CONSENT_FIELDS.filter((f) => f.kind === "boolean");
  const avoidZone =
    typeof consent.answers.avoidZone === "string"
      ? consent.answers.avoidZone
      : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {answered.map((field) => {
              const yes = consent.answers[field.id] === true;
              const detail = consent.answers[`${field.id}Detail`];
              return (
                <tr
                  key={field.id}
                  className={`border-sand-100 border-b last:border-0 ${
                    yes ? "bg-amber-50" : ""
                  }`}
                >
                  <td className="text-petroleum-700 py-2.5 pr-4 pl-2">
                    {tForm(`fields.${field.id}`)}
                  </td>
                  <td
                    className={`w-14 py-2.5 pr-4 font-medium ${
                      yes ? "text-amber-800" : "text-petroleum-400"
                    }`}
                  >
                    {yes ? tForm("yes") : tForm("no")}
                  </td>
                  <td className="text-petroleum-500 py-2.5 pr-2">
                    {typeof detail === "string" ? detail : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {avoidZone && (
        <p className="text-petroleum-700 rounded-xl bg-amber-50 px-4 py-3 text-sm">
          <span className="font-medium">{tForm("fields.avoidZone")}: </span>
          {avoidZone}
        </p>
      )}

      <ul className="text-petroleum-500 space-y-1 text-sm">
        <li>{tForm("treatment.accept")}</li>
        {consent.healthDataConsent && <li>{tForm("healthData.accept")}</li>}
        <li>{consent.imageConsent ? t("image.yes") : t("image.no")}</li>
      </ul>

      {consent.signatureDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={consent.signatureDataUrl}
          alt={tForm("signature")}
          className="border-sand-200 h-24 w-auto self-start rounded-xl border bg-white p-2"
        />
      )}
    </div>
  );
}
