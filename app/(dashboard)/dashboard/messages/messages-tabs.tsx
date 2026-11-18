"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { radioTarget } from "@/lib/radio-nav";
import { EmailPanel } from "./email/email-panel";
import { TemplatesPanel } from "./whatsapp/templates-panel";

export type TabKey = "whatsapp" | "email";

/** The automatic messages come first: they are what most people come here to edit. */
const TABS: TabKey[] = ["email", "whatsapp"];

export function MessagesTabs({
  initialTab = "email",
}: {
  initialTab?: TabKey;
}) {
  const t = useTranslations("dashboard.messages");
  const [active, setActive] = useState<TabKey>(initialTab);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  /**
   * Where the open tab puts its own buttons: top right, beside the title, as on
   * every other page. The tab owns them (and their state); the header only
   * gives them the place.
   */
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);

  /**
   * Picking a tab is remembered in the address, without a new history entry:
   * coming back from a message's page (or pressing back) lands on this tab.
   */
  function select(key: TabKey) {
    setActive(key);
    const url = new URL(window.location.href);
    // The default tab needs nothing in the address; the other one says so.
    if (key === "whatsapp") url.searchParams.set("tab", "whatsapp");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-petroleum-700 text-2xl">
            {t("title")}
          </h1>
          <p className="text-petroleum-400 mt-1 text-sm">{t("description")}</p>
        </div>
        <div
          ref={setActionsSlot}
          className="flex shrink-0 flex-wrap items-center gap-3 empty:hidden sm:justify-end"
        />
      </header>

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="border-sand-200 mt-6 mb-6 flex gap-1 border-b"
      >
        {TABS.map((key, index) => {
          const selected = active === key;
          return (
            <button
              key={key}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              id={`messages-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              // Only the open tab has a panel in the page.
              aria-controls={selected ? `messages-panel-${key}` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(key)}
              // Arrows move between tabs, as a tab list does.
              onKeyDown={(e) => {
                const target = radioTarget(e.key, index, TABS.length);
                if (target === null) return;
                e.preventDefault();
                select(TABS[target]);
                tabs.current[target]?.focus();
              }}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-petroleum-700 text-petroleum-700"
                  : "text-petroleum-400 hover:text-petroleum-700 border-transparent"
              }`}
            >
              {t(`tabs.${key}`)}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`messages-panel-${active}`}
        aria-labelledby={`messages-tab-${active}`}
      >
        {active === "whatsapp" && <TemplatesPanel actionsSlot={actionsSlot} />}
        {active === "email" && <EmailPanel />}
      </div>
    </div>
  );
}
