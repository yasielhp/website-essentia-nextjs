"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ConsentForm,
  type ConsentSubject,
} from "@/components/sections/consent/consent-form";
import { getAccessToken } from "@/lib/client-session";
import { resendConsent, sendConsentEmail } from "@/actions/consent";
import { CONSENT_FIELDS } from "@/lib/consent/fields";
import { TIME_ZONE } from "@/utils/format";
import { Button } from "@/components/ui/button";
import type { ContactConsent } from "@/types/consent";

/** `03/11/2026`: day first, whatever the language, as the centre writes dates. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

/** Asks before asking the client to sign again, and says what happens to the old signature. */
function ResendDialog({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.consent.resendDialog");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("title")}
          </h3>
          <p className="text-petroleum-400 text-sm">{t("body")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="solid"
            size="md"
            onClick={onConfirm}
            disabled={busy}
            className="w-full"
          >
            {busy ? t("sending") : t("confirm")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={busy}
            className="w-full"
          >
            {tCommon("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The contact's informed consent: what they answered, flagged where it matters
 * to the therapist, and the signature — or, while unsigned, a way to get it
 * signed, by link or in the centre with the client beside you.
 */
export function ConsentSection({
  loading,
  consent,
  contactId,
  subject,
  onSigned,
}: {
  loading: boolean;
  consent: ContactConsent | null;
  contactId: string;
  subject: ConsentSubject;
  onSigned: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.consent");
  const tForm = useTranslations("consent");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function resend() {
    setSending(true);
    setNotice(null);
    const { error, email } = await sendConsentEmail(
      getAccessToken(),
      contactId,
    );
    setSending(false);
    setNotice(
      error === null
        ? t("sentTo", { email: email ?? "" })
        : t(`sendError.${error}`),
    );
  }

  /** Reopens the signed consent and emails the client the link. */
  async function reopenAndSend() {
    setSending(true);
    setNotice(null);
    const result = await resendConsent(getAccessToken(), contactId);
    setSending(false);
    setConfirmOpen(false);
    setNotice(
      result.error === null
        ? t("sentTo", { email: result.email ?? "" })
        : t(`sendError.${result.error}`),
    );
    // Reopened even when the email failed, unless nothing was touched.
    if (result.error === null || result.error === "failed") onSigned();
  }

  if (loading) {
    return <div className="bg-sand-100 h-24 animate-pulse rounded-xl" />;
  }

  if (!consent?.signedAt) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-petroleum-400 text-sm">
            {consent ? t("pending") : t("unsigned")}
          </p>
          <div className="flex items-center gap-3">
            {notice && (
              <span className="text-petroleum-400 text-xs" role="status">
                {notice}
              </span>
            )}
            <button
              type="button"
              onClick={() => void resend()}
              disabled={sending}
              className="text-petroleum-700 text-sm underline underline-offset-4 hover:no-underline disabled:opacity-50"
            >
              {sending ? t("sending") : t("resend")}
            </button>
          </div>
        </div>
        <ConsentForm
          mode="staff"
          contactId={contactId}
          subject={subject}
          onSigned={onSigned}
          initial={
            consent
              ? {
                  answers: consent.answers,
                  imageConsent: consent.imageConsent,
                  healthDataConsent: consent.healthDataConsent,
                }
              : undefined
          }
        />
      </div>
    );
  }

  // Signed, and being corrected at the desk: the form again, filled in, which
  // writes nothing until it is signed. Cancel leaves the signed consent as it is.
  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-petroleum-400 text-sm">{t("editing")}</p>
        <ConsentForm
          mode="staff"
          contactId={contactId}
          subject={subject}
          replace
          initial={{
            answers: consent.answers,
            imageConsent: consent.imageConsent,
            healthDataConsent: consent.healthDataConsent,
          }}
          onSigned={() => {
            setEditing(false);
            onSigned();
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const answered = CONSENT_FIELDS.filter((f) => f.kind === "boolean");
  const avoidZone =
    typeof consent.answers.avoidZone === "string"
      ? consent.answers.avoidZone
      : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-petroleum-700 text-sm font-medium">
          {t("signed", { date: shortDate(consent.signedAt) })}
        </p>
        <div className="flex items-center gap-3">
          {notice && (
            <span className="text-petroleum-400 text-xs" role="status">
              {notice}
            </span>
          )}
          <Button
            variant="outline"
            size="md"
            onClick={() => setEditing(true)}
            disabled={sending}
          >
            {t("edit")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => setConfirmOpen(true)}
            disabled={sending}
          >
            {t("resendSigned")}
          </Button>
        </div>
      </div>

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

      {confirmOpen && (
        <ResendDialog
          busy={sending}
          onConfirm={() => void reopenAndSend()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
