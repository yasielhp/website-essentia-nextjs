"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * The question "reset this?" / "remove it?", asked in a modal dialog: a native
 * `<dialog>` opened with `showModal()`, as the other dialogs of the panel are
 * (the WhatsApp consent of a contact, the delete of a race), so the focus trap,
 * the Escape key and the page behind being inert come with it. The page keeps
 * nothing under the header moving.
 *
 * - `role="alertdialog"`, named by its title and described by its text.
 * - The focus starts on Cancel (the safe answer) and goes back to `returnTo`
 *   (the button that asked) when it closes.
 * - Escape and a click on the backdrop cancel, unless it is working: a write
 *   in flight cannot be dismissed halfway.
 * - While it works the confirm button says so and both are off; if it fails,
 *   `error` is shown here, inside, with the button ready to try again.
 *
 * It exists only while it is asked, so it is not in the page until the button
 * that opens it is pressed.
 */
export function ConfirmDialog({
  title,
  body,
  note,
  error,
  yesLabel,
  workingLabel,
  noLabel,
  returnTo,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  /** A second line that matters before saying yes (the reminder stays off). */
  note?: string;
  /** Why the last try failed; shown inside. */
  error?: string | null;
  yesLabel: string;
  workingLabel: string;
  noLabel: string;
  /** The id of the button that asked: the focus goes back to it. */
  returnTo: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;
  const dialogRef = useRef<HTMLDialogElement>(null);

  // The listeners are put once, so they read these and not the render they
  // were made in.
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
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();

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
      document.getElementById(returnTo)?.focus();
    };
    // Once per time it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape fires `cancel`; the page's state decides whether this is mounted.
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      // `m-auto` and the width live here: Tailwind's reset gives every element
      // `margin: 0`, which cancels the browser's own centring of a modal and
      // pins it to the top left, and a `<dialog>` is as wide as its content.
      className="m-auto w-[calc(100vw-2rem)] max-w-sm bg-transparent p-0 backdrop:bg-black/40"
    >
      <div className="w-full rounded-2xl bg-white p-6 shadow-xl">
        <h2 id={titleId} className="font-display text-petroleum-700 text-xl">
          {title}
        </h2>
        <div
          id={bodyId}
          className="text-petroleum-400 mt-2 flex flex-col gap-2 text-sm"
        >
          <p>{body}</p>
          {note && <p className="text-petroleum-700 font-medium">{note}</p>}
        </div>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            data-autofocus=""
            disabled={busy}
            onClick={onCancel}
          >
            {noLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? workingLabel : yesLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
