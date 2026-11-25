import { redirect } from "next/navigation";
import { getSessionUser } from "@/actions/auth";
import { NewTemplatePage } from "../../messages/whatsapp/new-template-page";

/**
 * A new WhatsApp template, on a page of its own instead of a window over the
 * templates card. `?from=<id>` rewrites a rejected template under a new name.
 * Admin only, as the card is.
 */
export default async function NewWhatsAppTemplateRoute({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { role } = await getSessionUser();
  if (role !== "admin") redirect("/dashboard");

  const { from } = await searchParams;
  const fromId = typeof from === "string" && from.length <= 64 ? from : null;

  return (
    <div className="px-6 py-8 lg:px-10">
      <NewTemplatePage fromId={fromId} />
    </div>
  );
}
