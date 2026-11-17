import { redirect } from "next/navigation";
import { getSessionUser } from "@/actions/auth";
import { MessagesTabs } from "./messages-tabs";

/**
 * The texts the centre sends: WhatsApp templates today, editable emails later.
 *
 * Admin only, decided here rather than in the browser for the same reason as
 * Settings: the session cookie is readable on the server, so staff are sent
 * back before a single template is fetched. The actions behind it check the
 * role again; this is the door, not the lock.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { role } = await getSessionUser();

  if (role !== "admin") redirect("/dashboard");

  // The way back from a message's own page lands on the tab it came from.
  const { tab } = await searchParams;

  return <MessagesTabs initialTab={tab === "email" ? "email" : "whatsapp"} />;
}
