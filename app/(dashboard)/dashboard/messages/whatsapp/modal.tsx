"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { IconX } from "@/components/ui/icons";

/**
 * The dashboard's modal frame: dimmed backdrop, a card, a title and a close
 * button; Escape and a click on the backdrop close it. Same shell as the
 * bonus plan modal, so the two feel alike.
 */
export function Modal({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const tCommon = useTranslations("dashboard.common");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`border-sand-200 mx-4 flex max-h-[90vh] w-full flex-col rounded-2xl border bg-white shadow-xl ${
          wide ? "max-w-4xl" : "max-w-lg"
        }`}
      >
        <div className="border-sand-100 flex shrink-0 items-center justify-between border-b px-6 py-4">
          <h3 className="text-petroleum-700 truncate font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="text-petroleum-300 hover:text-petroleum-500 ml-4 shrink-0 transition-colors"
          >
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
