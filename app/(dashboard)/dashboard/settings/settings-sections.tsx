"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BookingsSettings } from "@/components/dashboard/settings/bookings-settings";
import { SubscriptionsSettings } from "@/components/dashboard/settings/subscriptions-settings";
import { BonusPlansSettings } from "@/components/dashboard/settings/bonus-plans-settings";
import { PaymentsSettings } from "@/components/dashboard/settings/payments-settings";
import { CalendarSyncCard } from "@/components/dashboard/settings/calendar-sync-card";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="font-display text-petroleum-700 mb-6 text-2xl">{title}</h2>
      <div className="divide-sand-100 flex flex-col gap-8 divide-y [&>*:not(:first-child)]:pt-8">
        {children}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-petroleum-700 mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Every setting in the dashboard, as three cards with their sections inside.
 *
 * It used to be five tabs, and nobody could tell from the labels that deposits
 * and bonus plans belong to bookings. Who is allowed to see this screen is
 * settled on the server, in `page.tsx`.
 */
export function SettingsSections() {
  const t = useTranslations("dashboard.settings");

  return (
    <div className="px-6 py-8 lg:px-10">
      <h1 className="font-display text-petroleum-700 mb-6 text-3xl">
        {t("title")}
      </h1>

      <div className="flex flex-col gap-6">
        <Card title={t("tabs.bookings")}>
          <Section title={t("sections.sessionTypes")}>
            <BookingsSettings />
          </Section>
          <Section title={t("sections.payments")}>
            <PaymentsSettings />
          </Section>
          {/* Carries its own heading, with the button to add a plan. */}
          <div>
            <BonusPlansSettings />
          </div>
        </Card>

        <Card title={t("tabs.subscriptions")}>
          <SubscriptionsSettings />
        </Card>

        <Card title={t("tabs.calendar")}>
          <CalendarSyncCard />
        </Card>
      </div>
    </div>
  );
}
