"use server";

import { getAdminClient } from "@/lib/insforge-admin";

function computeInitials(name: string): string {
  const parts = name
    .replace(/^(Dr\.|Dra\.|Prof\.)\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return (parts[0]![0] ?? "").toUpperCase();
  return (
    (parts[0]![0] ?? "").toUpperCase() +
    (parts[parts.length - 1]![0] ?? "").toUpperCase()
  );
}

// The public "leave a review" form. It writes with `status = 'draft'`, so
// nothing reaches the home page until a member of staff publishes it, and the
// field lengths are capped just above to keep the table from being inflated.
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function submitReview(
  formData: FormData,
): Promise<{ error?: string }> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const quote = (formData.get("quote") as string | null)?.trim() ?? "";
  const age = (formData.get("age") as string | null)?.trim() ?? "";

  if (!name || !quote || !age) {
    return { error: "Name, age and review are required." };
  }

  // Public endpoint: cap field lengths so it cannot be used to bloat the table.
  if (name.length > 120 || age.length > 20 || quote.length > 2000) {
    return { error: "Some of the submitted values are too long." };
  }

  const db = getAdminClient();

  const { data: maxRow } = await db.database
    .from("reviews")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1);

  const maxOrder =
    ((maxRow as { display_order: number }[] | null)?.[0]?.display_order ?? 0) +
    1;

  const { error: dbError } = await db.database.from("reviews").insert({
    quote,
    name,
    age,
    initials: computeInitials(name),
    display_order: maxOrder,
    status: "draft",
  });

  if (dbError) {
    console.error("[submit-review]", dbError);
    return {
      error:
        (dbError as { message?: string })?.message ?? "Failed to save review.",
    };
  }

  return {};
}
