"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  ConsentForm,
  type ConsentSubject,
} from "@/components/sections/consent/consent-form";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { fetchContactDetail } from "@/actions/contacts";
import { fetchContactConsent, resendConsent } from "@/actions/consent";
import type { ContactConsent } from "@/types/consent";
import { ConsentActionsMenu } from "../consent-actions-menu";
import { ConsentView } from "../consent-view";
import { shortDate } from "../consent-date";
import { ResendConsentDialog } from "../resend-consent-dialog";

type PageState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "ready"; subject: ConsentSubject; consent: ContactConsent };

/**
 * A signed consent on a page of its own, with what can be done to it: correct
 * it at the desk or ask the client to sign again.
 *
 * Only a signed consent lives here. One that is unsigned, or reopened and
 * waiting for a signature, has nothing to show, so the visitor is sent back to
 * the contact's file, whose Consent tab handles exactly those states.
 */
export default function ContactConsentPage() {
  const t = useTranslations("dashboard.contacts.detail");
  const tConsent = useTranslations("dashboard.contacts.detail.consent");
  const tForm = useTranslations("consent");
  const { id } = useParams<{ id: string }>();
  const { replace, back } = useRouter();

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useDynamicBreadcrumb(
    state.kind === "ready" ? state.subject.name || null : null,
  );

  const load = useCallback(async () => {
    const result = await fetchContactDetail(getAccessToken(), id);
    if (!result.found) {
      setState({ kind: "not_found" });
      return;
    }
    const { contact } = result;
    const consent = await fetchContactConsent(getAccessToken(), id);
    if (!consent?.signedAt) {
      replace(`/dashboard/contacts/${id}`);
      return;
    }
    setState({
      kind: "ready",
      consent,
      subject: {
        name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
        email: contact.email,
        phone: contact.phone,
        birthdate: contact.birthdate,
      },
    });
  }, [id, replace]);

  useEffect(() => {
    async function run() {
      await load();
    }
    void run();
  }, [load]);

  async function reopenAndSend() {
    setBusy(true);
    setNotice(null);
    const result = await resendConsent(getAccessToken(), id);
    setBusy(false);
    setConfirmOpen(false);
    if (result.error === null) {
      notifySuccess(tConsent("sentTo", { email: result.email ?? "" }));
    } else {
      setNotice(tConsent(`sendError.${result.error}`));
    }
    // Reopened even when the email failed, unless nothing was touched: the
    // reload then finds it unsigned and takes the visitor to the contact's file.
    if (result.error === null || result.error === "failed") await load();
  }

  if (state.kind === "not_found") {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">{t("notFound")}</p>
        <button
          onClick={() => back()}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          {t("goBack")}
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-petroleum-700 text-3xl">
          {tForm("title")}
        </h1>
        <Button variant="outline" size="md" href={`/dashboard/contacts/${id}`}>
          {tConsent("backToContact")}
        </Button>
      </div>

      {state.kind === "loading" ? (
        <div className="bg-sand-100 h-40 animate-pulse rounded-2xl" />
      ) : editing ? (
        <div className="flex flex-col gap-4">
          <p className="text-petroleum-400 text-sm">{tConsent("editing")}</p>
          <ConsentForm
            mode="staff"
            contactId={id}
            subject={state.subject}
            replace
            initial={{
              answers: state.consent.answers,
              imageConsent: state.consent.imageConsent,
              healthDataConsent: state.consent.healthDataConsent,
            }}
            onSigned={() => {
              setEditing(false);
              void load();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="border-sand-200 flex flex-col gap-5 rounded-2xl border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-petroleum-700 text-sm font-medium">
              {tConsent("signed", {
                date: shortDate(state.consent.signedAt as string),
              })}
            </p>
            <div className="flex items-center gap-3">
              {notice && (
                <span className="text-petroleum-400 text-xs" role="status">
                  {notice}
                </span>
              )}
              <ConsentActionsMenu
                disabled={busy}
                onEdit={() => setEditing(true)}
                onResend={() => setConfirmOpen(true)}
              />
            </div>
          </div>
          <ConsentView consent={state.consent} />
        </div>
      )}

      {confirmOpen && (
        <ResendConsentDialog
          busy={busy}
          onConfirm={() => void reopenAndSend()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
