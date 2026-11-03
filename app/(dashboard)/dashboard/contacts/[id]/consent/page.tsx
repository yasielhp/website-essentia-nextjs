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
import { ConsentView } from "../consent-view";
import { shortDate } from "../consent-date";
import { ResendConsentDialog } from "../resend-consent-dialog";

type PageState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | {
      kind: "ready";
      subject: ConsentSubject;
      /** Null when nothing was ever filled in; unsigned when it was reopened. */
      consent: ContactConsent | null;
    };

/**
 * A contact's informed consent on a page of its own.
 *
 * Signed: the date, the whole consent, and — in the header — "Edit" to correct
 * it at the desk and "Resend" to ask the client to sign again. Unsigned, or
 * reopened and waiting for a signature: the form, to fill in with the client
 * beside you, pre-filled with the earlier answers when there are any.
 */
export default function ContactConsentPage() {
  const t = useTranslations("dashboard.contacts.detail");
  const tConsent = useTranslations("dashboard.contacts.detail.consent");
  const tForm = useTranslations("consent");
  const { id } = useParams<{ id: string }>();
  const { back } = useRouter();

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
  }, [id]);

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
    // Reopened even when the email failed, unless nothing was touched; the
    // reload then shows the form waiting for the new signature.
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

  const signed = state.kind === "ready" && Boolean(state.consent?.signedAt);

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-petroleum-700 text-3xl">
          {tForm("title")}
        </h1>
        {signed && !editing && (
          <div className="flex items-center gap-3">
            {notice && (
              <span className="text-petroleum-400 text-xs" role="status">
                {notice}
              </span>
            )}
            <Button
              variant="solid"
              size="md"
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              {tConsent("edit")}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
            >
              {tConsent("resendSigned")}
            </Button>
          </div>
        )}
      </div>

      {state.kind === "loading" ? (
        <div className="bg-sand-100 h-40 animate-pulse rounded-2xl" />
      ) : editing && state.consent ? (
        // Signed, and being corrected: Cancel leaves the signed consent as it is.
        <div className="flex flex-col gap-4">
          <ConsentForm
            mode="staff"
            contactId={id}
            subject={state.subject}
            replace
            initial={{
              answers: state.consent.answers,
              imageConsent: state.consent.imageConsent,
              healthDataConsent: state.consent.healthDataConsent,
              signatureDataUrl: state.consent.signatureDataUrl,
            }}
            onSigned={() => {
              setEditing(false);
              void load();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : state.consent?.signedAt ? (
        <div className="border-sand-200 flex flex-col gap-5 rounded-2xl border bg-white p-6">
          <p className="text-petroleum-700 text-sm font-medium">
            {tConsent("signed", { date: shortDate(state.consent.signedAt) })}
          </p>
          <ConsentView consent={state.consent} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-petroleum-400 text-sm">
            {state.consent ? tConsent("pending") : tConsent("unsigned")}
          </p>
          <ConsentForm
            mode="staff"
            contactId={id}
            subject={state.subject}
            onSigned={() => void load()}
            initial={
              state.consent
                ? {
                    answers: state.consent.answers,
                    imageConsent: state.consent.imageConsent,
                    healthDataConsent: state.consent.healthDataConsent,
                  }
                : undefined
            }
          />
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
