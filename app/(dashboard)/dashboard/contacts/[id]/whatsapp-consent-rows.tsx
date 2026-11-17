"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import {
  clearWhatsAppSuppression,
  clearWhatsAppUnreachable,
  fetchWhatsAppSuppression,
  setMarketingConsent,
  setWhatsAppConsent,
} from "@/actions/contacts";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import {
  suppressionView,
  type SuppressionLookup,
} from "@/lib/whatsapp/suppression-ui";
import { Button } from "@/components/ui/button";
import { getAccessToken } from "@/lib/client-session";
import {
  marketingNotes,
  marketingRowState,
  whatsappConsentState,
  type ContactConsentColumns,
  type MarketingRowState,
  type WhatsAppPurpose,
} from "@/lib/whatsapp/consent";
import { shortDate } from "./consent-date";
import { WhatsAppConsentDialog } from "./whatsapp-consent-dialog";

/** The hint under "News and offers" for each state, as keys of `whatsapp.marketing.hint`. */
const MARKETING_HINT: Record<MarketingRowState, string> = {
  on: "marketing.hint.on",
  off: "marketing.hint.off",
  email_only: "marketing.hint.emailOnly",
  whatsapp_only: "marketing.hint.whatsappOnly",
  opted_out: "marketing.hint.optedOut",
};

const MARKETING_NOTE = {
  no_email: "marketing.notes.noEmail",
  bounced: "marketing.notes.bounced",
  email_unsubscribed: "marketing.notes.emailUnsubscribed",
} as const;

/**
 * What this contact accepts, two switches: "Appointment notices" (WhatsApp)
 * and "News and offers", which is ONE consent for email AND WhatsApp, as it is
 * on the public booking form.
 *
 * Unlike the contact's details these do not wait for Save: a consent is an
 * event with a date. Turning one off is immediate. Turning one on asks first,
 * because it is the team speaking for the client and it clears the contact's
 * own STOP. Mounted only once the contact has loaded, so the first state is the
 * stored one.
 */
export function WhatsAppConsentRows({
  contactId,
  initial,
}: {
  contactId: string;
  initial: ContactConsentColumns;
}) {
  const t = useTranslations("dashboard.contacts.detail.whatsapp");
  const tCommon = useTranslations("dashboard.common");
  const [columns, setColumns] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState<WhatsAppPurpose | null>(null);
  // Meta's "this number has no WhatsApp", kept apart from the consents: a
  // save of a consent does not return it.
  const [unreachableAt, setUnreachableAt] = useState(
    initial.whatsapp_unreachable_at ?? null,
  );
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  // The STOP list is by number. What it says is read once; a list that cannot
  // be read (its table may not exist yet) is the same as one that says nothing.
  const [suppression, setSuppression] = useState<SuppressionLookup>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removalFailed, setRemovalFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchWhatsAppSuppression(getAccessToken(), contactId)
      .catch(() => null)
      .then((result) => {
        if (!cancelled) setSuppression(result);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const state = whatsappConsentState(columns);
  const marketing = marketingRowState(columns);
  const notes = marketingNotes(columns);

  async function save(purpose: WhatsAppPurpose, enabled: boolean) {
    setSaving(true);
    setFailed(false);
    try {
      const result =
        purpose === "marketing"
          ? await setMarketingConsent(getAccessToken(), contactId, enabled)
          : await setWhatsAppConsent(
              getAccessToken(),
              contactId,
              "appointments",
              enabled,
            );
      if (result.ok) {
        const { ok: _ok, ...stored } = result;
        void _ok;
        setColumns((prev) => ({ ...prev, ...stored }));
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

  async function removeSuppression() {
    setRemoving(true);
    setRemovalFailed(false);
    try {
      const result = await clearWhatsAppSuppression(
        getAccessToken(),
        contactId,
      );
      if (result.ok) {
        setSuppression({ ok: true, suppressed: false });
        setConfirmingRemoval(false);
      } else {
        setRemovalFailed(true);
      }
    } catch {
      setRemovalFailed(true);
    } finally {
      setRemoving(false);
    }
  }

  async function resetUnreachable() {
    setResetting(true);
    setResetFailed(false);
    try {
      const result = await clearWhatsAppUnreachable(
        getAccessToken(),
        contactId,
      );
      if (result.ok) {
        setUnreachableAt(null);
        setConfirmingReset(false);
      } else {
        setResetFailed(true);
      }
    } catch {
      setResetFailed(true);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {suppressionView(suppression) === "listed" && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <p>{t("suppression.note")}</p>
          {confirmingRemoval ? (
            <RemovalConfirm
              busy={removing}
              onCancel={() => setConfirmingRemoval(false)}
              onConfirm={() => void removeSuppression()}
            />
          ) : (
            <div>
              <Button
                id="whatsapp-suppression-remove"
                variant="outline"
                size="sm"
                onClick={() => setConfirmingRemoval(true)}
              >
                {t("suppression.removeLabel")}
              </Button>
            </div>
          )}
          {removalFailed && (
            <p role="alert" className="text-xs text-red-600">
              {t("suppression.error")}
            </p>
          )}
        </div>
      )}

      {unreachableAt && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-800"
        >
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              {t("unreachable", { date: shortDate(unreachableAt) })}
            </p>
            <p className="text-xs">{t("unreachableWhy")}</p>
          </div>
          {confirmingReset ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs">{t("unreachableConfirm")}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={resetting}
                onClick={() => setConfirmingReset(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                size="sm"
                disabled={resetting}
                onClick={() => void resetUnreachable()}
              >
                {resetting
                  ? t("unreachableResetting")
                  : t("unreachableConfirmYes")}
              </Button>
            </div>
          ) : (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmingReset(true)}
              >
                {t("unreachableReset")}
              </Button>
            </div>
          )}
          {resetFailed && (
            <p role="alert" className="text-xs text-red-600">
              {t("unreachableError")}
            </p>
          )}
        </div>
      )}

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

      <ToggleRow
        checked={state.appointments === "accepted"}
        disabled={saving}
        label={t("appointments.label")}
        hint={
          state.appointments === "accepted" && columns.whatsapp_opted_in_at
            ? t("accepted", { date: shortDate(columns.whatsapp_opted_in_at) })
            : t("none")
        }
        onToggle={() =>
          state.appointments === "accepted"
            ? void save("appointments", false)
            : setAsking("appointments")
        }
      />

      <ToggleRow
        checked={marketing === "on"}
        disabled={saving}
        label={t("marketing.label")}
        hint={t(MARKETING_HINT[marketing], {
          date: columns.whatsapp_marketing_opted_in_at
            ? shortDate(columns.whatsapp_marketing_opted_in_at)
            : "",
        })}
        onToggle={() =>
          marketing === "on"
            ? void save("marketing", false)
            : setAsking("marketing")
        }
      />
      {notes.map((note) => (
        <p key={note} className="text-petroleum-400 px-1 text-xs">
          {t(MARKETING_NOTE[note], {
            date: columns.newsletter_unsubscribed_at
              ? shortDate(columns.newsletter_unsubscribed_at)
              : "",
          })}
        </p>
      ))}

      {failed && (
        <p role="alert" className="px-1 text-xs text-red-500">
          {t("error")}
        </p>
      )}

      {asking && (
        <WhatsAppConsentDialog
          purpose={asking}
          optedOut={state.optedOut}
          emailUnsubscribed={
            asking === "marketing" && notes.includes("email_unsubscribed")
          }
          busy={saving}
          onConfirm={() => void save(asking, true)}
          onCancel={() => setAsking(null)}
        />
      )}
    </div>
  );
}

/** "Take this number off the STOP list?"; focus to the safe answer and back. */
function RemovalConfirm({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.whatsapp.suppression");
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, () =>
    document.getElementById("whatsapp-suppression-remove"),
  );
  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label={t("removeConfirm")}
      className="flex flex-col gap-2"
    >
      <p className="text-xs">{t("removeConfirm")}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>
          {t("removeNo")}
        </Button>
        <Button size="sm" disabled={busy} onClick={onConfirm}>
          {busy ? t("removing") : t("removeYes")}
        </Button>
      </div>
    </div>
  );
}
