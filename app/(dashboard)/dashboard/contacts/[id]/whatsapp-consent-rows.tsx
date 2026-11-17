"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { setWhatsAppConsent } from "@/actions/contacts";
import { getAccessToken } from "@/lib/client-session";
import {
  whatsappConsentColumn,
  whatsappConsentState,
  type WhatsAppConsentColumns,
  type WhatsAppPurpose,
} from "@/lib/whatsapp/consent";
import { shortDate } from "./consent-date";
import { WhatsAppConsentDialog } from "./whatsapp-consent-dialog";

const PURPOSES: WhatsAppPurpose[] = ["appointments", "marketing"];

/**
 * What this contact accepts on WhatsApp, one row per purpose, and the switches
 * staff use to record it.
 *
 * Unlike the newsletter switch, these do not wait for Save: a consent is an
 * event with a date. Turning one off is immediate. Turning one on asks first,
 * because it clears the contact's own STOP. Mounted only once the contact has
 * loaded, so the first state is the stored one.
 */
export function WhatsAppConsentRows({
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
  const [asking, setAsking] = useState<WhatsAppPurpose | null>(null);

  const state = whatsappConsentState(columns);

  async function save(purpose: WhatsAppPurpose, enabled: boolean) {
    setSaving(true);
    setFailed(false);
    try {
      const result = await setWhatsAppConsent(
        getAccessToken(),
        contactId,
        purpose,
        enabled,
      );
      if (result.ok) {
        setColumns({
          whatsapp_opted_in_at: result.whatsapp_opted_in_at,
          whatsapp_marketing_opted_in_at: result.whatsapp_marketing_opted_in_at,
          whatsapp_opted_out_at: result.whatsapp_opted_out_at,
        });
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
      setAsking(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {state.optedOut && columns.whatsapp_opted_out_at && (
        <p
          role="status"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {t("optedOutNote", {
            date: shortDate(columns.whatsapp_opted_out_at),
          })}
        </p>
      )}

      {PURPOSES.map((purpose) => {
        const accepted = state[purpose] === "accepted";
        const since = columns[whatsappConsentColumn(purpose)];
        return (
          <ToggleRow
            key={purpose}
            checked={accepted}
            disabled={saving}
            label={t(`${purpose}.label`)}
            hint={
              accepted && since
                ? t("accepted", { date: shortDate(since) })
                : t("none")
            }
            onToggle={() =>
              accepted ? void save(purpose, false) : setAsking(purpose)
            }
          />
        );
      })}

      <p className="text-petroleum-400 px-1 text-xs">{t("savesNow")}</p>
      {failed && (
        <p role="alert" className="px-1 text-xs text-red-500">
          {t("error")}
        </p>
      )}

      {asking && (
        <WhatsAppConsentDialog
          purpose={asking}
          optedOut={state.optedOut}
          busy={saving}
          onConfirm={() => void save(asking, true)}
          onCancel={() => setAsking(null)}
        />
      )}
    </div>
  );
}
