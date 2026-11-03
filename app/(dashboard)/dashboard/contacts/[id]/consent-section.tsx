"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { sendConsentEmail } from "@/actions/consent";
import { Button } from "@/components/ui/button";
import type { ContactConsent } from "@/types/consent";
import { shortDate } from "./consent-date";

/**
 * Where a contact's informed consent stands, in one row. Signed: the date and
 * the way to read it. Not signed (or reopened and waiting): "Sign" to fill it in
 * at the centre with the client, and "Send" to email them the link. Everything
 * else — the answers, the signature, the form — lives on the consent page.
 */
export function ConsentSection({
  loading,
  consent,
  contactId,
}: {
  loading: boolean;
  consent: ContactConsent | null;
  contactId: string;
}) {
  const t = useTranslations("dashboard.contacts.detail.consent");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const page = `/dashboard/contacts/${contactId}/consent`;

  async function send() {
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
    return <div className="bg-sand-100 h-10 animate-pulse rounded-xl" />;
  }

  if (!consent?.signedAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-petroleum-400 text-sm">
          {consent ? t("pending") : t("unsigned")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {notice && (
            <span className="text-petroleum-400 text-xs" role="status">
              {notice}
            </span>
          )}
          <Button
            variant="outline"
            size="lg"
            onClick={() => void send()}
            disabled={sending}
          >
            {sending ? t("sending") : t("send")}
          </Button>
          <Button variant="solid" size="lg" href={page}>
            {t("sign")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-petroleum-700 text-sm font-medium">
        {t("signed", { date: shortDate(consent.signedAt) })}
      </p>
      <Button variant="solid" size="lg" href={page}>
        {t("view")}
      </Button>
    </div>
  );
}
