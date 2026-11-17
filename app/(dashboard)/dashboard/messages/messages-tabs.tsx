"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TemplatesPanel } from "./whatsapp/templates-panel";

type TabKey = "whatsapp" | "email";

/** `enabled: false` is a tab that is announced but cannot be opened yet. */
const TABS: { key: TabKey; enabled: boolean }[] = [
  { key: "whatsapp", enabled: true },
  // Editable emails are a later phase; the tab is here so nobody wonders
  // where they went.
  { key: "email", enabled: false },
];

export function MessagesTabs() {
  const t = useTranslations("dashboard.messages");
  const tCommon = useTranslations("dashboard.common");
  const [active, setActive] = useState<TabKey>("whatsapp");

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="font-display text-petroleum-700 text-2xl">{t("title")}</h1>
      <p className="text-petroleum-400 mt-1 text-sm">{t("description")}</p>

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="border-sand-200 mt-6 mb-6 flex gap-1 border-b"
      >
        {TABS.map(({ key, enabled }) => {
          const selected = active === key;
          return (
            <button
              key={key}
              id={`messages-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`messages-panel-${key}`}
              aria-disabled={!enabled}
              disabled={!enabled}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "border-petroleum-700 text-petroleum-700"
                  : enabled
                    ? "text-petroleum-400 hover:text-petroleum-700 border-transparent"
                    : "text-petroleum-300 cursor-not-allowed border-transparent"
              }`}
            >
              {t(`tabs.${key}`)}
              {!enabled && (
                <span className="bg-sand-100 text-petroleum-400 rounded-full px-2 py-0.5 text-[11px] font-medium">
                  {tCommon("comingSoon")}
                </span>
              )}
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
      </div>
    </div>
  );
}
