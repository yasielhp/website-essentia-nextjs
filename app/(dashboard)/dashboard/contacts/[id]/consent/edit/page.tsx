"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ConsentForm } from "@/components/sections/consent/consent-form";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { useConsentPage } from "../../consent-data";

/**
 * Correcting a signed consent, on a page of its own.
 *
 * The form opens filled in with what was answered and with the signature on
 * file in the box, so any answer can be changed without the client signing
 * again. Saving or cancelling goes back to the consent. A consent that is not
 * signed has nothing to correct and goes back there too, where the form to
 * fill it in lives.
 */
export default function EditContactConsentPage() {
  const t = useTranslations("dashboard.contacts.detail");
  const tForm = useTranslations("consent");
  const { id } = useParams<{ id: string }>();
  const { push, replace, back } = useRouter();
  const { state } = useConsentPage(id);

  const consentHref = `/dashboard/contacts/${id}/consent`;

  useDynamicBreadcrumb(
    state.kind === "ready" ? state.subject.name || null : null,
  );

  const unsigned =
    state.kind === "ready" && !state.consent?.signedAt ? true : false;
  useEffect(() => {
    if (unsigned) replace(consentHref);
  }, [unsigned, replace, consentHref]);

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
      <h1 className="font-display text-petroleum-700 mb-6 text-3xl">
        {tForm("title")}
      </h1>

      {state.kind === "loading" || unsigned || !state.consent ? (
        <div className="bg-sand-100 h-40 animate-pulse rounded-2xl" />
      ) : (
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
          onSigned={() => push(consentHref)}
          onCancel={() => push(consentHref)}
        />
      )}
    </div>
  );
}
