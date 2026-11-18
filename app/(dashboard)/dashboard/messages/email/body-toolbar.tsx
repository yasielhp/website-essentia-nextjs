"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { IconPlus } from "@/components/ui/icons";
import { radioTarget } from "@/lib/radio-nav";
import { isLinkVariable } from "@/lib/messages/editor-state";
import type { FixedBlock } from "@/lib/messages/catalog";
import { variableKind } from "@/lib/messages/variable-kinds";
import { KIND_TONE, KindIcon } from "./variable-kind-ui";

/**
 * The bar over the body of an email: the variables to insert where the cursor
 * is, and the blocks that were taken out, to put back. It stays at the top of
 * the editor as the body scrolls under it, and on a phone the variables slide
 * sideways. A toolbar to the keyboard: one stop, and the arrows move along it.
 *
 * Pressing a chip does not take the focus from where the person was writing
 * (the mouse goes down without focusing it), so the caret stays put; the
 * address variables are not offered while the caret is in the title, where an
 * address has no place.
 */
export function BodyToolbar({
  variables,
  disabled,
  inTitle,
  missing,
  onInsert,
  onAddBlock,
}: {
  variables: readonly string[];
  disabled: boolean;
  /** The caret is in the title. */
  inTitle: boolean;
  /** The blocks of the message the document lacks. */
  missing: readonly FixedBlock[];
  onInsert: (name: string) => void;
  onAddBlock: (block: FixedBlock) => void;
}) {
  const t = useTranslations("dashboard.messages.email");
  const tEditor = useTranslations("dashboard.messages.email.editor");
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  // The menu closes on Escape and on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div className="border-sand-100 sticky top-0 z-10 flex items-start gap-2 rounded-t-2xl border-b bg-white px-3 py-2">
      <div
        role="toolbar"
        aria-label={tEditor("variablesTitle")}
        aria-orientation="horizontal"
        className="flex min-w-0 flex-1 snap-x [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
      >
        {variables.map((name, index) => {
          const kind = variableKind(name);
          const blocked = inTitle && isLinkVariable(name);
          return (
            <button
              key={name}
              ref={(el) => {
                chips.current[index] = el;
              }}
              type="button"
              tabIndex={index === active ? 0 : -1}
              disabled={disabled}
              aria-disabled={blocked || undefined}
              title={blocked ? tEditor("variableNotInTitle") : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onFocus={() => setActive(index)}
              onClick={() => {
                if (!blocked) onInsert(name);
              }}
              onKeyDown={(e) => {
                const target = radioTarget(e.key, index, variables.length);
                if (target === null) return;
                e.preventDefault();
                setActive(target);
                chips.current[target]?.focus();
              }}
              className={`focus-visible:ring-petroleum-500 inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-opacity focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 sm:min-h-8 ${
                kind ? KIND_TONE[kind] : "bg-sand-100 text-petroleum-700"
              } ${blocked ? "opacity-40" : ""}`}
            >
              {kind && <KindIcon kind={kind} />}
              {t(`variables.${name}`)}
            </button>
          );
        })}
      </div>
      {missing.length > 0 && (
        <div ref={menu} className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen((v) => !v)}
            className="border-sand-200 text-petroleum-700 hover:border-petroleum-400 focus-visible:ring-petroleum-500 inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-3 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 sm:min-h-8"
          >
            <IconPlus />
            {tEditor("addBlock")}
          </button>
          {open && (
            <div
              role="menu"
              aria-label={tEditor("addBlock")}
              className="border-sand-200 absolute right-0 z-20 mt-1 flex w-64 flex-col rounded-xl border bg-white p-1 shadow-lg"
            >
              {missing.map((block) => (
                <button
                  key={block}
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setOpen(false);
                    onAddBlock(block);
                  }}
                  className="text-petroleum-700 hover:bg-sand-100 focus-visible:bg-sand-100 min-h-11 rounded-lg px-3 text-left text-sm focus-visible:outline-none sm:min-h-9"
                >
                  {t(`fixed.${block}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
