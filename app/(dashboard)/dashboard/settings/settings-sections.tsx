"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BookingsSettings } from "@/components/dashboard/settings/bookings-settings";
import { SubscriptionsSettings } from "@/components/dashboard/settings/subscriptions-settings";
import { BonusPlansSettings } from "@/components/dashboard/settings/bonus-plans-settings";
import { PaymentsSettings } from "@/components/dashboard/settings/payments-settings";

/**
 * One group of settings. Each carries its own heading ("All sessions", "All
 * vouchers"…), so the card adds none: it only gathers what belongs together.
 */
function SettingsCard({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section
      id={`settings-${id}`}
      className="border-sand-200 scroll-mt-20 rounded-2xl border bg-white p-6"
    >
      {children}
    </section>
  );
}

/**
 * Every setting in the dashboard, as cards one under another: sessions,
 * vouchers, subscriptions and payments. They were tabs, which hid all but one
 * of them behind a click. Who may see this screen is settled on the server, in
 * `page.tsx`.
 */
export function SettingsSections() {
  const t = useTranslations("dashboard.settings");

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="font-display text-petroleum-700 mb-6 text-3xl">
        {t("title")}
      </h1>

      <div className="flex flex-col gap-6">
        <SettingsCard id="bookings">
          <BookingsSettings />
        </SettingsCard>
        <SettingsCard id="bonuses">
          <BonusPlansSettings />
        </SettingsCard>
        <SettingsCard id="subscriptions">
          <SubscriptionsSettings />
        </SettingsCard>
        <SettingsCard id="payments">
          <PaymentsSettings />
        </SettingsCard>
      </div>
    </div>
  );
}
