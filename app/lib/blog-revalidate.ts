import { revalidatePath, revalidateTag } from "next/cache";
import { BLOG_POSTS_CACHE_TAG } from "@/lib/sitemap-data";

/**
 * Publishes a blog change to the live site straight away.
 *
 * The blog pages are ISR with a one-hour window, so without this an edited post
 * stays stale for up to an hour and a new one is missing from the listing for
 * just as long. SERVER ONLY and with no check of who is asking: the dashboard's
 * Server Action (`revalidateBlog`) and the MCP tools each do their own before
 * calling it.
 *
 * Both slugs are passed because a post has one per language, and the Spanish
 * one may be absent, in which case that tree serves the English slug.
 */
export function revalidateBlogPaths(slug?: string, slugEs?: string): void {
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
