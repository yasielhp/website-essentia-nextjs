"use client";

import {
  createContext,
  useContext,
  useState,
  useId,
  type ReactNode,
} from "react";

// ─── Contexto de grupo ────────────────────────────────────────

type AccordionGroupContextValue = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

const AccordionGroupContext = createContext<AccordionGroupContextValue | null>(null);
import { IconChevronDown } from "@components/icons";

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

function Header({ children }: { children: ReactNode }) {
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
        className="text-petroleum-400 shrink-0 transition-transform duration-300 ease-in-out"
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
      value={{ isOpen, toggle, triggerId: `${id}-trigger`, panelId: `${id}-panel` }}
    >
      <div
        className={`border-petroleum-100 border-b last:border-b-0 ${className ?? ""}`}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

function Group({ children, className }: { children: ReactNode; className?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <AccordionGroupContext.Provider value={{ openId, setOpenId }}>
      <div className={className}>{children}</div>
    </AccordionGroupContext.Provider>
  );
}

// ─── Export compuesto ─────────────────────────────────────────

export const Accordion = Object.assign(AccordionRoot, {
  Header,
  Content,
  Group,
});
