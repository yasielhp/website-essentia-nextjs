"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { WhatsAppPurpose } from "@/lib/whatsapp/consent";

/**
 * Asks before turning a WhatsApp consent on, because that is the click that
 * can undo a person's own STOP. Turning one off needs no question.
 *
 * A native `<dialog>` opened with `showModal()`, as the race delete
 * confirmation is: the focus trap, Escape and focus restoration come with it.
 * Cancel comes first, so it is the button focused on open.
 */
export function WhatsAppConsentDialog({
  purpose,
  optedOut,
  busy,
  onConfirm,
  onCancel,
}: {
  purpose: WhatsAppPurpose;
  /** The contact replied STOP: the warning is the stronger one. */
  optedOut: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.whatsapp");
  const tCommon = useTranslations("dashboard.common");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const busyRef = useRef(busy);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    busyRef.current = busy;
    onCancelRef.current = onCancel;
  }, [busy, onCancel]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    dialog.showModal();

    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target === dialog && !busyRef.current) onCancelRef.current();
    };
    dialog.addEventListener("click", closeOnBackdrop);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      dialog.removeEventListener("click", closeOnBackdrop);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="whatsapp-consent-title"
      aria-describedby="whatsapp-consent-body"
      // Escape fires `cancel`; React state stays what decides whether this is
      // mounted, and a write in flight cannot be dismissed halfway.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="bg-transparent p-0 backdrop:bg-black/40"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2
          id="whatsapp-consent-title"
          className="font-display text-petroleum-700 text-xl"
        >
          {t("dialog.title")}
        </h2>
        <div
          id="whatsapp-consent-body"
          className="text-petroleum-400 mt-2 flex flex-col gap-2 text-sm"
        >
          <p>{t("dialog.body", { use: t(`${purpose}.label`) })}</p>
          {optedOut && (
            <p className="text-petroleum-700 font-medium">
              {t("dialog.optedOutBody")}
            </p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={busy}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="solid"
            size="md"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t("dialog.confirming") : t("dialog.confirm")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
