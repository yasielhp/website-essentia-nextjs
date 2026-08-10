"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { setUserPassword } from "@/actions/set-user-password";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/input";
import { INPUT_CLASS } from "@/constants/form-styles";

/**
 * Changing your own password.
 *
 * It owns its own state — the two fields, the error, the confirmation and the
 * busy flag — because nothing outside reads any of it. Held in the page, those
 * five values were five reasons for the whole account screen to re-render
 * while someone typed a password into it.
 */
export function PasswordSection({ userId }: { userId: string }) {
  const t = useTranslations("dashboard.account");

  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);
    if (pwNew !== pwConfirm) {
      setPwError(t("password.mismatch"));
      return;
    }
    if (pwNew.length < 8) {
      setPwError(t("password.tooShort"));
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await setUserPassword(getAccessToken(), userId, pwNew);
      if (error) {
        setPwError(error);
        return;
      }
      setPwNew("");
      setPwConfirm("");
      setPwOk(true);
    } finally {
      // A thrown action used to leave the form disabled with no way back.
      setPwLoading(false);
    }
  }

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.security")}
      </h2>
      <form
        onSubmit={(e) => void handleChangePw(e)}
        className="space-y-4"
        noValidate
      >
        {pwError && (
          <p className="rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {pwError}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="pw-new"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("password.new")}
          </label>
          <PasswordInput
            id="pw-new"
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            placeholder={t("password.placeholder")}
            disabled={pwLoading}
            autoComplete="new-password"
            inputClassName={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="pw-confirm"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("password.confirm")}
          </label>
          <PasswordInput
            id="pw-confirm"
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            placeholder={t("password.placeholder")}
            disabled={pwLoading}
            autoComplete="new-password"
            inputClassName={INPUT_CLASS}
          />
        </div>

        <div className="flex items-center justify-end gap-4">
          {pwOk && (
            <p className="text-sm font-medium text-green-700">
              {t("password.updated")}
            </p>
          )}
          <Button
            type="submit"
            variant="solid"
            size="md"
            disabled={pwLoading || !pwNew || !pwConfirm}
          >
            {pwLoading ? t("saving") : t("password.change")}
          </Button>
        </div>
      </form>
    </div>
  );
}
