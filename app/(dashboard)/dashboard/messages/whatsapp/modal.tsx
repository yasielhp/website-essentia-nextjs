"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { IconX } from "@/components/ui/icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  );
}

/**
 * The dashboard's modal frame: dimmed backdrop, a card, a title and a close
 * button.
 *
 * Closing: Escape and the close button always close it; a click on the
 * backdrop only when `dirty` is false, so a stray click cannot throw away a
 * form someone has been typing in. While `busy` nothing closes it, because
 * the request in flight would finish with nobody to tell. An Escape another
 * handler already used (an open dropdown) is not ours to act on.
 *
 * Keyboard: focus moves in on open (to the element marked `data-autofocus`,
 * else to the card), Tab cycles inside the card, and focus goes back to
 * whatever opened it on close. The page behind does not scroll meanwhile.
 */
export function Modal({
  title,
  onClose,
  wide = false,
  dirty = false,
  busy = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  /** Unsaved input: a click on the backdrop must not close the modal. */
  dirty?: boolean;
  /** A request is in flight: no way of closing the modal is honoured. */
  busy?: boolean;
  children: React.ReactNode;
}) {
  const tCommon = useTranslations("dashboard.common");
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  /** A click that started inside the card and ended on the backdrop is a drag. */
  const pressedOnOverlay = useRef(false);

  // Latest values for the listeners, which are attached once.
  const latest = useRef({ onClose, busy });
  useEffect(() => {
    latest.current = { onClose, busy };
  });

  // Focus in, focus back, no scrolling behind.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const target =
      dialog?.querySelector<HTMLElement>("[data-autofocus]") ?? dialog;
    target?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (e.defaultPrevented || latest.current.busy) return;
        latest.current.onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = focusableIn(dialog);
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onMouseDown={(e) => {
        pressedOnOverlay.current = e.target === overlayRef.current;
      }}
      onClick={(e) => {
        if (
          e.target === overlayRef.current &&
          pressedOnOverlay.current &&
          !dirty &&
          !busy
        ) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`border-sand-200 mx-4 flex max-h-[90vh] w-full flex-col rounded-2xl border bg-white shadow-xl outline-none ${
          wide ? "max-w-4xl" : "max-w-lg"
        }`}
      >
        <div className="border-sand-100 flex shrink-0 items-center justify-between border-b px-6 py-4">
          <h3 className="text-petroleum-700 truncate font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={tCommon("close")}
            className="text-petroleum-400/50 hover:text-petroleum-500 ml-4 shrink-0 transition-colors disabled:opacity-40"
          >
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
