"use client";

import {
  useCallback,
  useId,
  useMemo,
  useState,
  use,
  type ReactNode,
} from "react";
import { AccordionContext, AccordionGroupContext } from "./context";

type AccordionProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

/**
 * One accordion item.
 *
 * Inside a `<Accordion.Group>` the group owns which item is open, so opening
 * one closes the others; on its own the item keeps that in local state.
 */
export function AccordionRoot({
  children,
  defaultOpen = false,
  className,
}: AccordionProps) {
  const [localOpen, setLocalOpen] = useState<boolean>(() => defaultOpen);
  const id = useId();
  const group = use(AccordionGroupContext);

  const isOpen = group ? group.openId === id : localOpen;
  const toggle = useCallback(() => {
    if (group) {
      group.setOpenId(group.openId === id ? null : id);
    } else {
      setLocalOpen((v) => !v);
    }
  }, [group, id]);

  const value = useMemo(
    () => ({
      isOpen,
      toggle,
      triggerId: `${id}-trigger`,
      panelId: `${id}-panel`,
    }),
    [isOpen, toggle, id],
  );

  return (
    <AccordionContext.Provider value={value}>
      <div className={`${className ?? ""}`}>{children}</div>
    </AccordionContext.Provider>
  );
}
