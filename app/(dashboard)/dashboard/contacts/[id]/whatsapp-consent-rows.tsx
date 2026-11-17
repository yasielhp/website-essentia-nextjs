"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import {
  clearWhatsAppSuppression,
  clearWhatsAppUnreachable,
  fetchWhatsAppSuppression,
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
