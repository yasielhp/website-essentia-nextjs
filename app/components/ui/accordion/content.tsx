"use client";

import type { ReactNode } from "react";
import { useAccordion } from "./context";

export function AccordionContent({ children }: { children: ReactNode }) {
  const { isOpen, triggerId, panelId } = useAccordion();
  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={triggerId}
      suppressHydrationWarning
      // Height from `0fr` to `1fr`: the panel animates open without anyone
      // measuring it first.
      className="grid transition-[grid-template-rows] duration-300 ease-in-out"
      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
