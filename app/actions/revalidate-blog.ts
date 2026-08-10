"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { BLOG_POSTS_CACHE_TAG } from "@/lib/sitemap-data";

/**
 * Publishes a blog change to the live site straight away.
 *
 * The blog pages are ISR with a one-hour window, so editing a post used to
 * leave the old copy up for up to an hour, and a new post stayed missing from
 * the listing for just as long — the post itself appeared on first visit,
 * because `dynamicParams` is on, but nothing linked to it. Nobody was clearing
 * any of it.
 *
 * Revalidating beats rebuilding: a deploy would rebuild every page on the site
 * to change one, and takes minutes rather than milliseconds.
 *
 * Both slugs are passed because a post has one per language, and the Spanish
 * one may be absent, in which case that tree serves the English slug.
 */
export async function revalidateBlog(
  accessToken: string | null,
  slug?: string,
  slugEs?: string,
) {
  // Only the blog editor calls this, and it is a Server Action — a public HTTP
  // endpoint. Left open, anyone could purge the cache of an arbitrary path in
  // a loop and make every following visit re-render the page from scratch.
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return;
    throw err;
  }

  // The listings, in both trees.
  revalidatePath("/blog");
  revalidatePath("/es/blog");

  // The post itself, wherever it lives.
  if (slug) {
    revalidatePath(`/blog/${slug}`);
    revalidatePath(`/es/blog/${slugEs || slug}`);
  }

  // The sitemaps read a cached list of published posts.
  revalidateTag(BLOG_POSTS_CACHE_TAG, "max");
}
