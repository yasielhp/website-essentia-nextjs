"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/input";
import { INPUT_CLASS } from "@/constants/form-styles";
import { getAccessToken } from "@/lib/client-session";
import { setUserPassword } from "@/actions/set-user-password";

/**
 * Sets a new password for this account, on somebody else's behalf.
 *
 * Its own state rather than the page's: the two fields, the error and the
 * spinner are nobody's business but this card's, and the page reducer was
 * carrying five extra keys to no end.
 */
export function PasswordSection({
  userId,
  saving,
}: {
  userId: string;
  saving: boolean;
}) {
  const t = useTranslations("dashboard.users.form");
  const tToasts = useTranslations("dashboard.toasts");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  async function handleChangePw() {
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
    notifySuccess(tToasts("passwordChanged"));
  }

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.password")}
      </h2>
      <div className="space-y-4">
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
            disabled={pwLoading || saving}
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
            disabled={pwLoading || saving}
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
            type="button"
            variant="solid"
            size="md"
            onClick={() => void handleChangePw()}
            disabled={pwLoading || saving || !pwNew || !pwConfirm}
          >
            {pwLoading ? t("saving") : t("password.change")}
          </Button>
        </div>
      </div>
    </div>
  );
}
