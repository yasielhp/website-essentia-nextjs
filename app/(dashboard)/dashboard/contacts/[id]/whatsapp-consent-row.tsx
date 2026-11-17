"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { setWhatsAppConsent } from "@/actions/contacts";
import { getAccessToken } from "@/lib/client-session";
import {
  whatsappConsentState,
  type WhatsAppConsentColumns,
} from "@/lib/whatsapp/consent";
import { shortDate } from "./consent-date";

/**
 * Whether this contact takes WhatsApp, and the switch staff use to record it.
 *
 * Unlike the newsletter switch next to it, this one does not wait for Save:
 * a consent is an event with a date, and the date is the point. Mounted only
 * once the contact has loaded, so the first state is the stored one.
 */
export function WhatsAppConsentRow({
  contactId,
  initial,
}: {
  contactId: string;
  initial: WhatsAppConsentColumns;
}) {
  const t = useTranslations("dashboard.contacts.detail.whatsapp");
  const [columns, setColumns] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const state = whatsappConsentState(columns);

  const hint =
    state === "accepted" && columns.whatsapp_opted_in_at
      ? t("accepted", { date: shortDate(columns.whatsapp_opted_in_at) })
      : state === "opted_out" && columns.whatsapp_opted_out_at
        ? t("optedOut", { date: shortDate(columns.whatsapp_opted_out_at) })
        : t("none");

  async function toggle() {
    setSaving(true);
    setFailed(false);
    try {
      const result = await setWhatsAppConsent(
        getAccessToken(),
        contactId,
        state !== "accepted",
      );
      if (result.ok) {
        setColumns({
          whatsapp_opted_in_at: result.whatsapp_opted_in_at,
          whatsapp_opted_out_at: result.whatsapp_opted_out_at,
        });
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <ToggleRow
        checked={state === "accepted"}
        disabled={saving}
        label={t("label")}
        hint={hint}
        onToggle={() => void toggle()}
      />
      <p className="text-petroleum-400 px-1 text-xs">
        {state === "opted_out" ? t("reoptWarning") : t("savesNow")}
      </p>
      {failed && (
        <p role="alert" className="px-1 text-xs text-red-500">
          {t("error")}
        </p>
      )}
    </div>
  );
}
