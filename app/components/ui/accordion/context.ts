"use client";

import { createContext, use } from "react";

/**
 * The two contexts an accordion runs on, and the hook that reads the inner one.
 *
 * They sit apart from the components so each of those can be a file with one
 * component in it, which is the whole point of the split.
 */

export type AccordionGroupContextValue = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

/** Present only inside `<Accordion.Group>`, where one open item closes the rest. */
export const AccordionGroupContext =
  createContext<AccordionGroupContextValue | null>(null);

export type AccordionContextValue = {
  isOpen: boolean;
  toggle: () => void;
  triggerId: string;
  panelId: string;
};

export const AccordionContext = createContext<AccordionContextValue | null>(
  null,
);

export function useAccordion() {
  const ctx = use(AccordionContext);
  if (!ctx)
    throw new Error(
      "Accordion.Header y Accordion.Content deben usarse dentro de <Accordion>",
    );
  return ctx;
}

/** What `<Accordion.Group>` exposes through a ref. */
export type AccordionGroupHandle = { close: () => void };
