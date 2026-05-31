import { createClient } from "@insforge/sdk";
import { manualTherapyTreatments } from "@/data/services-data";
import { contact } from "@/constants/contact";

export const siteBase = `https://${contact.domain}`;

export const staticRoutes = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/wellness", priority: 0.9, changeFrequency: "weekly" },
  {
    path: "/wellness/contrast-therapy",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/wellness/red-light-therapy",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/wellness/breathing-sessions",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/wellness/manual-therapies",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/wellness/functional-well-being",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  { path: "/medicine", priority: 0.9, changeFrequency: "weekly" },
  {
    path: "/medicine/hyperbaric-chambers",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/medicine/intravenous-therapy",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/medicine/regenerative-medicine",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  { path: "/community", priority: 0.8, changeFrequency: "weekly" },
  { path: "/community/memberships", priority: 0.85, changeFrequency: "weekly" },
  {
    path: "/community/running-club",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/community/education-programs",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.8, changeFrequency: "daily" },
  { path: "/shop", priority: 0.6, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
  { path: "/booking", priority: 0.9, changeFrequency: "weekly" },
] as const;

export function getTreatmentPaths(): string[] {
  return manualTherapyTreatments.map(
    (t) => `/wellness/manual-therapies/${t.id}`,
  );
}

export type BlogPost = {
  slug: string;
  lastModified?: Date;
};

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    const db = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    });
    const { data } = await db.database
      .from("blog_posts")
      .select("slug, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    return (
      (data as { slug: string; published_at: string | null }[]) ?? []
    ).map((post) => ({
      slug: post.slug,
      lastModified: post.published_at ? new Date(post.published_at) : undefined,
    }));
  } catch {
    return [];
  }
}
