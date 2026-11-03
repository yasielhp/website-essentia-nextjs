"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ConsentForm,
  type ConsentSubject,
} from "@/components/sections/consent/consent-form";
import { getAccessToken } from "@/lib/client-session";
import { sendConsentEmail } from "@/actions/consent";
import { Button } from "@/components/ui/button";
import type { ContactConsent } from "@/types/consent";
import { shortDate } from "./consent-date";

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
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  // Signed: the date and the way to the page that shows it in full.
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-petroleum-700 text-sm font-medium">
        {t("signed", { date: shortDate(consent.signedAt) })}
      </p>
      <Button
        variant="outline"
        size="md"
        href={`/dashboard/contacts/${contactId}/consent`}
      >
        {t("view")}
      </Button>
    </div>
  );
}
