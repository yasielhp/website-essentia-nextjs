"use client";

import {
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { AccordionGroupContext, type AccordionGroupHandle } from "./context";

/** Holds a set of items where only one is open at a time. */
export function AccordionGroup({
  children,
  className,
  ref,
}: {
  children: ReactNode;
  className?: string;
  ref?: Ref<AccordionGroupHandle>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    close: () => setOpenId(null),
  }));

  const groupValue = useMemo(() => ({ openId, setOpenId }), [openId]);

  return (
    <AccordionGroupContext.Provider value={groupValue}>
      <div className={className}>{children}</div>
    </AccordionGroupContext.Provider>
  );
}
