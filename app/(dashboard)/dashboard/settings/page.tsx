"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRole } from "@/context/role-context";
import { TabButton } from "@/components/dashboard/settings/tab-button";
import { BookingsSettings } from "@/components/dashboard/settings/bookings-settings";
import { SubscriptionsSettings } from "@/components/dashboard/settings/subscriptions-settings";

type SettingsTab = "bookings" | "subscriptions";

const TABS: SettingsTab[] = ["bookings", "subscriptions"];

/**
 * Every setting in the dashboard, in one place.
 *
 * They used to be scattered: services and tiers on a page under Bookings and
 * plans on one under Subscriptions, neither of them called Settings.
 *
 * Races and education kept only a calendar colour here, which nobody changed
 * and which the overview now takes from the session type anyway.
 *
 * Admin only, which the bookings panel already required on its own.
 */
export default function SettingsPage() {
  const t = useTranslations("dashboard.settings");
  const { role } = useRole();
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>("bookings");

  const allowed = role === "admin";

  useEffect(() => {
    if (role && !allowed) router.replace("/dashboard");
  }, [role, allowed, router]);

  // Nothing until the role is known and it is the right one. Rendering first
  // and redirecting afterwards showed a member of staff the whole settings
  // screen — panels, plans and prices — for as long as the redirect took.
  if (!allowed) return null;

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
