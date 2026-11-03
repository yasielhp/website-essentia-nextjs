"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsentSubject } from "@/components/sections/consent/consent-form";
import { getAccessToken } from "@/lib/client-session";
import { fetchContactDetail } from "@/actions/contacts";
import { fetchContactConsent } from "@/actions/consent";
import type { ContactConsent } from "@/types/consent";

export type ConsentPageState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | {
      kind: "ready";
      subject: ConsentSubject;
      /** Null when nothing was ever filled in; unsigned when it was reopened. */
      consent: ContactConsent | null;
    };

/**
 * A contact and their consent, for the consent page and the page that edits
 * it: who they are, as the form wants to see it, and what is on file.
 */
export function useConsentPage(id: string) {
  const [state, setState] = useState<ConsentPageState>({ kind: "loading" });

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

  return { state, load };
}
