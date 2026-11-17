"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { radioTarget } from "@/lib/radio-nav";
import { EmailPanel } from "./email/email-panel";
import { TemplatesPanel } from "./whatsapp/templates-panel";

type TabKey = "whatsapp" | "email";

const TABS: TabKey[] = ["whatsapp", "email"];

export function MessagesTabs() {
  const t = useTranslations("dashboard.messages");
  const [active, setActive] = useState<TabKey>("whatsapp");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="font-display text-petroleum-700 text-2xl">{t("title")}</h1>
      <p className="text-petroleum-400 mt-1 text-sm">{t("description")}</p>

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
              aria-controls={`messages-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(key)}
              // Arrows move between tabs, as a tab list does.
              onKeyDown={(e) => {
                const target = radioTarget(e.key, index, TABS.length);
                if (target === null) return;
                e.preventDefault();
                setActive(TABS[target]);
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
        {active === "whatsapp" && <TemplatesPanel />}
        {active === "email" && <EmailPanel />}
      </div>
    </div>
  );
}
