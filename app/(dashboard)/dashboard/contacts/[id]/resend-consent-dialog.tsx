"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Asks before emailing the client to update or sign again, and says what happens to the old signature. */
export function ResendConsentDialog({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.consent.resendDialog");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("title")}
          </h3>
          <p className="text-petroleum-700 text-sm">{t("body")}</p>
          <p className="text-petroleum-400 mt-1 text-xs">{t("note")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="solid"
            size="md"
            onClick={onConfirm}
            disabled={busy}
            className="w-full"
          >
            {busy ? t("sending") : t("confirm")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={busy}
            className="w-full"
          >
            {tCommon("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
