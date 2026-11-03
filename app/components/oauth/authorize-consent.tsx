"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { decideAuthorization } from "@/actions/oauth";

type Params = {
  clientId: string;
  redirectUri: string;
  state: string | undefined;
  codeChallenge: string;
  scope: string;
  resource: string | null;
};

/**
 * Allow or Cancel. Either answer ends with the browser going back to the
 * assistant, at the address the server builds and checks; nothing here builds
 * that address.
 */
export function AuthorizeConsent({
  allowed,
  params,
}: {
  /** Whether this person's role may connect an assistant at all. */
  allowed: boolean;
  params: Params;
}) {
  const t = useTranslations("oauth.consent");
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "allow" | "deny") {
    setBusy(decision);
    setError(null);
    const result = await decideAuthorization({ decision, ...params });
    if (result.url) {
      window.location.assign(result.url);
      return;
    }
    setBusy(null);
    setError(result.error === "forbidden" ? t("forbidden") : t("failed"));
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {allowed ? (
        <ul className="text-petroleum-500 list-disc space-y-1 pl-5 text-sm">
          <li>{t("canRead")}</li>
          <li>{t("canDraft")}</li>
        </ul>
      ) : (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("forbidden")}
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {allowed && (
          <Button
            variant="solid"
            size="lg"
            onClick={() => void decide("allow")}
            disabled={busy !== null}
            className="w-full"
          >
            {busy === "allow" ? t("allowing") : t("allow")}
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          onClick={() => void decide("deny")}
          disabled={busy !== null}
          className="w-full"
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
