import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/actions/auth";
import { parseMessageRoute } from "@/lib/messages/message-route";
import { WhatsAppMessagePage } from "../../../email/message-pages";

/**
 * The WhatsApp notice of one message, in one language, on a page of its own.
 * Only the messages that can go out on WhatsApp have one; the rest, and any
 * language that is not one, are a 404. Admin only, as the list is.
 */
export default async function WhatsAppMessageRoute({
  params,
}: {
  params: Promise<{ key: string; locale: string }>;
}) {
  const { role } = await getSessionUser();
  if (role !== "admin") redirect("/dashboard");

  const { key, locale } = await params;
  const route = parseMessageRoute("whatsapp", key, locale);
  if (!route.ok) notFound();

  return <WhatsAppMessagePage messageKey={route.key} locale={route.locale} />;
}
