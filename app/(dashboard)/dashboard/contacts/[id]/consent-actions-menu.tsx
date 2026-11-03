"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pencil, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconChevronDown } from "@/components/ui/icons";

/**
 * One button that opens the two things that can be done to a signed consent:
 * correct it at the desk, or ask the client to sign again.
 *
 * Behaves like the avatar menu — closes on a click outside — and also on
 * Escape, handing focus back to the button so a keyboard user is not dropped.
 */
export function ConsentActionsMenu({
  disabled,
  onEdit,
  onResend,
}: {
  disabled?: boolean;
  onEdit: () => void;
  onResend: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.consent");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.querySelector("button")?.focus();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "text-petroleum-500 hover:bg-sand-50 flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors";

  return (
    <div ref={ref} className="relative">
      <div ref={triggerRef}>
        <Button
          variant="outline"
          size="md"
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {t("actions")}
          <IconChevronDown />
        </Button>
      </div>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="border-sand-200 absolute top-full right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className={item}
          >
            <Pencil size={16} aria-hidden />
            {t("edit")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onResend();
            }}
            className={item}
          >
            <Send size={16} aria-hidden />
            {t("resendSigned")}
          </button>
        </div>
      )}
    </div>
  );
}
