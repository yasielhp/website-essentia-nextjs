"use client";

import { insforge } from "@/lib/insforge";
import { bookableServices } from "@/data/services-data";

/**
 * The services a booking can actually be made for, as the public flow sees
 * them.
 *
 * The dashboard offered eight and the website four. `service_settings` carries
 * a row per service with `active = true` for all of them, including the ones
 * whose pages only say "Coming Soon", so staff could start a booking for
 * Contrast Therapy or Hyperbaric Chambers — and for Functional Well-Being,
 * which no longer exists at all. They showed as a letter on a grey square,
 * because there was no entry in `bookableServices` to give them an image or a
 * description.
 *
 * `bookableServices` is that public list, so intersecting with it makes the two
 * agree by construction rather than by remembering to update both.
 */

export type BookableServiceOption = {
  id: string;
  title: string;
  image?: string;
  description?: string;
  category?: string;
};

export async function fetchBookableServices(): Promise<
  BookableServiceOption[]
> {
  const { data } = await insforge.database
    .from("service_settings")
    .select("id, title")
    .eq("active", true)
    .order("title");

  const rows = (data as { id: string; title: string }[] | null) ?? [];

  return rows.flatMap((row) => {
    const known = bookableServices.find((b) => b.id === row.id);
    // Anything the public site does not offer is dropped rather than rendered
    // half-populated.
    if (!known) return [];
    return [
      {
        id: row.id,
        // The title comes from the database so staff can rename a service
        // without a deploy; everything else is presentation.
        title: row.title,
        image: known.image,
        description: known.description,
        category: known.category,
      },
    ];
  });
}
