"use client";

import {
  createContext,
  useContext,
  useState,
  useId,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
} from "react";

import { IconChevronDown } from "@components/icons";

// ─── Contexto de grupo ────────────────────────────────────────

type AccordionGroupContextValue = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

const AccordionGroupContext = createContext<AccordionGroupContextValue | null>(
  null,
);

// ─── Contexto interno ─────────────────────────────────────────

type AccordionContextValue = {
  isOpen: boolean;
  toggle: () => void;
  triggerId: string;
  panelId: string;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion() {
  const ctx = useContext(AccordionContext);
  if (!ctx)
    throw new Error(
      "Accordion.Header y Accordion.Content deben usarse dentro de <Accordion>",
    );
  return ctx;
}

// ─── Subcomponentes ───────────────────────────────────────────

function Header({
  children,
  iconClassName,
}: {
  children: ReactNode;
  iconClassName?: string;
}) {
  const { isOpen, toggle, triggerId, panelId } = useAccordion();
  return (
    <button
      id={triggerId}
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={toggle}
      className="text-petroleum-700 flex w-full cursor-pointer items-center justify-between gap-4 py-5 transition-colors duration-200"
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

function Content({ children }: { children: ReactNode }) {
  const { isOpen, triggerId, panelId } = useAccordion();
  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={triggerId}
      className="grid transition-all duration-300 ease-in-out"
      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

// ─── Componente raíz ──────────────────────────────────────────

type AccordionProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

function AccordionRoot({
  children,
  defaultOpen = false,
  className,
}: AccordionProps) {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const id = useId();
  const group = useContext(AccordionGroupContext);

  const isOpen = group ? group.openId === id : localOpen;
  const toggle = () => {
    if (group) {
      group.setOpenId(group.openId === id ? null : id);
    } else {
      setLocalOpen((v) => !v);
    }
  };

  return (
    <AccordionContext.Provider
      value={{
        isOpen,
        toggle,
        triggerId: `${id}-trigger`,
        panelId: `${id}-panel`,
      }}
    >
      <div
        className={`border-petroleum-100 border-b last:border-b-0 ${className ?? ""}`}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

// ─── Group con ref imperativo ─────────────────────────────────

export type AccordionGroupHandle = { close: () => void };

const Group = forwardRef<AccordionGroupHandle, { children: ReactNode; className?: string }>(
  function Group({ children, className }, ref) {
    const [openId, setOpenId] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      close: () => setOpenId(null),
    }));

    return (
      <AccordionGroupContext.Provider value={{ openId, setOpenId }}>
        <div className={className}>{children}</div>
      </AccordionGroupContext.Provider>
    );
  },
);

// ─── Export compuesto ─────────────────────────────────────────

export const Accordion = Object.assign(AccordionRoot, {
  Header,
  Content,
  Group,
});
