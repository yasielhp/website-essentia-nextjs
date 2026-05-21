import type { MetadataRoute } from "next";
import { createClient } from "@insforge/sdk";
import { manualTherapyTreatments } from "@/data/services-data";
import { contact } from "@/constants/contact";

const base = `https://${contact.domain}`;

const staticRoutes: { url: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { url: "/", priority: 1.0, changeFrequency: "weekly" },
  { url: "/wellness", priority: 0.9, changeFrequency: "weekly" },
  { url: "/wellness/contrast-therapy", priority: 0.8, changeFrequency: "monthly" },
  { url: "/wellness/red-light-therapy", priority: 0.8, changeFrequency: "monthly" },
  { url: "/wellness/breathing-sessions", priority: 0.8, changeFrequency: "monthly" },
  { url: "/wellness/manual-therapies", priority: 0.8, changeFrequency: "monthly" },
  { url: "/wellness/functional-well-being", priority: 0.8, changeFrequency: "monthly" },
  { url: "/medicine", priority: 0.9, changeFrequency: "weekly" },
  { url: "/medicine/hyperbaric-chambers", priority: 0.8, changeFrequency: "monthly" },
  { url: "/medicine/intravenous-therapy", priority: 0.8, changeFrequency: "monthly" },
  { url: "/medicine/regenerative-medicine", priority: 0.8, changeFrequency: "monthly" },
  { url: "/community", priority: 0.8, changeFrequency: "weekly" },
  { url: "/community/memberships", priority: 0.85, changeFrequency: "weekly" },
  { url: "/community/running-club", priority: 0.7, changeFrequency: "monthly" },
  { url: "/community/education-programs", priority: 0.7, changeFrequency: "monthly" },
  { url: "/about", priority: 0.7, changeFrequency: "monthly" },
  { url: "/blog", priority: 0.8, changeFrequency: "daily" },
  { url: "/shop", priority: 0.6, changeFrequency: "weekly" },
  { url: "/contact", priority: 0.7, changeFrequency: "monthly" },
  { url: "/booking", priority: 0.9, changeFrequency: "weekly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const treatmentRoutes: MetadataRoute.Sitemap = manualTherapyTreatments.map((t) => ({
    url: `${base}/wellness/manual-therapies/${t.id}`,
    priority: 0.7,
    changeFrequency: "monthly",
  }));

  // Fetch published blog posts
  let blogRoutes: MetadataRoute.Sitemap = [];
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

    blogRoutes = ((data as { slug: string; published_at: string | null }[]) ?? []).map(
      (post) => ({
        url: `${base}/blog/${post.slug}`,
        lastModified: post.published_at ? new Date(post.published_at) : undefined,
        priority: 0.6,
        changeFrequency: "monthly" as const,
      }),
    );
  } catch {
    // Blog posts fetch failed silently — sitemap still works without them
  }

  return [
    ...staticRoutes.map((r) => ({ ...r, url: `${base}${r.url}` })),
    ...treatmentRoutes,
    ...blogRoutes,
  ];
}
