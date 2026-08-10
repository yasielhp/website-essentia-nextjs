import { redirect } from "next/navigation";
import { getSessionUser } from "@/actions/auth";
import { SettingsTabs } from "./settings-tabs";

/**
 * Every setting in the dashboard, in one place.
 *
 * They used to be scattered: services and tiers on a page under Bookings and
 * plans on one under Subscriptions, neither of them called Settings.
 *
 * Races and education kept only a calendar colour here, which nobody changed
 * and which the overview now takes from the session type anyway.
 *
 * Admin only — and decided here rather than in the browser. The screen used to
 * render, read the role from context, and then `router.replace()` out of an
 * effect, which meant a member of staff saw the panels, the plans and the
 * prices for as long as that took. The session cookie is readable on the
 * server, so the answer is known before anything is sent.
 */
export default async function SettingsPage() {
  const { role } = await getSessionUser();

  if (role !== "admin") redirect("/dashboard");

  return <SettingsTabs />;
}
