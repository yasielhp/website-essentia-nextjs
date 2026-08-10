"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconTrash, IconSpinner } from "@/components/ui/icons";

export type ConfirmDeleteModalProps = {
  title: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  title,
  deleting,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const t = useTranslations("dashboard.races.edit");
  const tCommon = useTranslations("dashboard.common");
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The listener below is registered once, so it reads these rather than
  // closing over the values one particular render happened to have.
  const deletingRef = useRef(deleting);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    deletingRef.current = deleting;
    onCancelRef.current = onCancel;
  }, [deleting, onCancel]);

  /**
   * A native `<dialog>` opened with `showModal()`, not a div wearing
   * `role="dialog"`.
   *
   * The hand-rolled version had no focus trap, so Tab walked straight out of
   * the confirmation and into the form behind it — the same form the dialog is
   * asking permission to delete. `showModal()` brings the trap, Escape, the
   * backdrop and focus restoration to whatever opened it; the only thing left
   * to do by hand is the scroll lock, which the browser does not provide.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    dialog.showModal();

    // Click-outside-to-close, bound here rather than as an `onClick` prop: the
    // backdrop belongs to the dialog element, and a click handler on the
    // element itself would be a click target keyboard users cannot reach.
    // Escape and the cancel button are what they use, and both already work.
    const closeOnBackdrop = (event: MouseEvent) => {
      if (event.target === dialog && !deletingRef.current)
        onCancelRef.current();
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
      aria-labelledby="delete-race-title"
      aria-describedby="delete-race-body"
      // Escape fires `cancel`. Prevented so React state stays the one thing
      // that decides whether this is mounted, and so a delete in flight cannot
      // be dismissed halfway.
      onCancel={(e) => {
        e.preventDefault();
        if (!deleting) onCancel();
      }}
      className="bg-transparent p-0 backdrop:bg-black/40"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2
          id="delete-race-title"
          className="font-display text-petroleum-700 text-xl"
        >
          {t("deleteDialog.title")}
        </h2>
        <p id="delete-race-body" className="text-petroleum-400 mt-2 text-sm">
          {t.rich("deleteDialog.body", {
            name: () => (
              <span className="text-petroleum-500 font-medium">{title}</span>
            ),
          })}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          {/* First in the tab order and the one `showModal()` focuses, so the
              destructive button is never the default target. */}
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            className="gap-2"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <IconSpinner className="animate-spin" />
            ) : (
              <IconTrash />
            )}
            {deleting ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
