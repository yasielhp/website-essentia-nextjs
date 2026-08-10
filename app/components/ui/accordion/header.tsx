"use client";

import type { ReactNode } from "react";
import { IconChevronDown } from "@components/ui/icons";
import { useAccordion } from "./context";

export function AccordionHeader({
  children,
  iconClassName,
}: {
  children: ReactNode;
  iconClassName?: string;
}) {
  const { isOpen, toggle, triggerId, panelId } = useAccordion();
  return (
    <button
      type="button"
      id={triggerId}
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={toggle}
      suppressHydrationWarning
      className="text-petroleum-700 flex w-full cursor-pointer items-center justify-between gap-4 py-2.5 transition-colors duration-200"
    >
      <span>{children}</span>
      <span
        className={`shrink-0 transition-transform duration-300 ease-in-out ${iconClassName ?? "text-petroleum-400"}`}
        style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        aria-hidden="true"
      >
        <IconChevronDown />
      </span>
    </button>
  );
}
