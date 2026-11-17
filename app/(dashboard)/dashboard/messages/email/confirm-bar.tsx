"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/hooks/use-dialog-focus";

/**
 * A question asked in place of the buttons it came from ("reset this?",
 * "remove it?"): an `alertdialog` whose focus goes to the safe answer when it
 * appears and back to `returnTo` (the id of the button that asked) when it
 * goes. It exists only while it is asked.
 */
export function ConfirmBar({
  message,
  yesLabel,
  noLabel,
  returnTo,
  busy,
  onCancel,
  onConfirm,
}: {
  message: string;
  yesLabel: string;
  noLabel: string;
  returnTo: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, () => document.getElementById(returnTo));
  return (
    <div
      ref={ref}
      role="alertdialog"
      aria-label={message}
      className="flex max-w-xs flex-col gap-2"
    >
      <p className="text-petroleum-700 text-xs">{message}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-11 sm:h-8"
          disabled={busy}
          onClick={onCancel}
        >
          {noLabel}
        </Button>
        <Button
          size="sm"
          variant="danger"
          className="h-11 sm:h-8"
          disabled={busy}
          onClick={onConfirm}
        >
          {yesLabel}
        </Button>
      </div>
    </div>
  );
}
