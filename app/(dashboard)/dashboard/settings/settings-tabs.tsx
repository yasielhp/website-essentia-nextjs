"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TabButton } from "@/components/dashboard/settings/tab-button";
import { BookingsSettings } from "@/components/dashboard/settings/bookings-settings";
import { SubscriptionsSettings } from "@/components/dashboard/settings/subscriptions-settings";

type SettingsTab = "bookings" | "subscriptions";

const TABS: SettingsTab[] = ["bookings", "subscriptions"];

/**
 * The tabs themselves, which are the only part of this screen that needs a
 * browser. Who is allowed to see them is settled on the server, in `page.tsx`.
 */
export function SettingsTabs() {
  const t = useTranslations("dashboard.settings");
  const [tab, setTab] = useState<SettingsTab>("bookings");

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="font-display text-petroleum-700 mb-6 text-3xl">
        {t("title")}
      </h1>

      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="border-sand-100 -mx-6 -mt-6 mb-6 flex gap-1 overflow-x-auto border-b px-4 py-3">
          {TABS.map((id) => (
            <TabButton key={id} active={tab === id} onClick={() => setTab(id)}>
              <span className="whitespace-nowrap">{t(`tabs.${id}`)}</span>
            </TabButton>
          ))}
        </div>

        {tab === "bookings" && <BookingsSettings />}
        {tab === "subscriptions" && <SubscriptionsSettings />}
      </div>
    </div>
  );
}
