import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/actions/auth";
import { parseMessageRoute } from "@/lib/messages/message-route";
import { EmailMessagePage } from "../../message-pages";

/**
 * One email, in one language, on a page of its own. Admin only, decided here
 * for the reason the list's page decides it: staff are sent back before
 * anything is read. The key and the language come from the address, so they are
 * checked against the catalogue and anything else is a 404.
 */
export default async function EmailMessageRoute({
  params,
}: {
  params: Promise<{ key: string; locale: string }>;
}) {
  const { role } = await getSessionUser();
  if (role !== "admin") redirect("/dashboard");

  const { key, locale } = await params;
  const route = parseMessageRoute("email", key, locale);
  if (!route.ok) notFound();

  return <EmailMessagePage messageKey={route.key} locale={route.locale} />;
}
