import { unstable_cache } from "next/cache";

/** Cache tag for the published-post list the sitemaps build from. */
export const BLOG_POSTS_CACHE_TAG = "blog-posts";
import { insforgePublic as insforge } from "@/lib/insforge-public";
import {
  facialTreatments,
  manualTherapyTreatments,
} from "@/data/services-data";
import { contact } from "@/constants/contact";
import { isUnlaunched } from "@/constants/unlaunched";

export const siteBase =
  process.env.NEXT_PUBLIC_APP_URL ?? `https://${contact.domain}`;

const allStaticRoutes = [
  { path: "/", esPath: "/", priority: 1.0, changeFrequency: "weekly" },
  {
    path: "/wellness",
    esPath: "/bienestar",
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    path: "/wellness/contrast-therapy",
    esPath: "/bienestar/terapia-de-contraste",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/wellness/red-light-therapy",
    esPath: "/bienestar/terapia-de-luz-roja",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/wellness/breathing-sessions",
    esPath: "/bienestar/sesiones-de-respiracion",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/wellness/manual-therapies",
    esPath: "/bienestar/terapias-manuales",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/wellness/facial-therapies",
    esPath: "/bienestar/terapias-faciales",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/medicine",
    esPath: "/medicina",
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    path: "/medicine/hyperbaric-chambers",
    esPath: "/medicina/camaras-hiperbaricas",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/medicine/intravenous-therapy",
    esPath: "/medicina/terapia-intravenosa",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/medicine/regenerative-medicine",
    esPath: "/medicina/medicina-regenerativa",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/experiences",
    esPath: "/experiencias",
    priority: 0.8,
    changeFrequency: "weekly",
  },
  {
    path: "/experiences/memberships",
    esPath: "/experiencias/membresias",
    priority: 0.85,
    changeFrequency: "weekly",
  },
  {
    path: "/experiences/running-club",
    esPath: "/experiencias/running-club",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/experiences/education-programs",
    esPath: "/experiencias/programas-educativos",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/about",
    esPath: "/nosotros",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  { path: "/blog", esPath: "/blog", priority: 0.8, changeFrequency: "daily" },
  {
    path: "/shop",
    esPath: "/tienda",
    priority: 0.6,
    changeFrequency: "weekly",
  },
  {
    path: "/contact",
    esPath: "/contacto",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/booking",
    esPath: "/reserva",
    priority: 0.9,
    changeFrequency: "weekly",
  },
] as const;

/**
 * What the sitemap actually offers.
 *
 * A sitemap is a list of pages worth indexing, so the "Coming Soon" routes are
 * filtered out rather than deleted — a service launching only has to leave
 * `UNLAUNCHED_ROUTES` and it reappears here with its priority intact.
 */
export const staticRoutes = allStaticRoutes.filter(
  (r) => !isUnlaunched(r.path),
);

export function getTreatmentPaths(): { path: string; esPath: string }[] {
  return [
    ...manualTherapyTreatments.map((t) => ({
      path: `/wellness/manual-therapies/${t.id}`,
      esPath: `/bienestar/terapias-manuales/${t.id}`,
    })),
    ...facialTreatments.map((t) => ({
      path: `/wellness/facial-therapies/${t.id}`,
      esPath: `/bienestar/terapias-faciales/${t.id}`,
    })),
  ];
}

export type BlogPost = {
  slug: string;
  slugEs: string | null;
  lastModified?: string;
};

export const fetchBlogPosts = unstable_cache(
  async (): Promise<BlogPost[]> => {
    try {
      const { data } = await insforge.database
        .from("blog_posts")
        .select("slug, slug_es, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      return (
        (data as {
          slug: string;
          slug_es: string | null;
          published_at: string | null;
        }[]) ?? []
      ).map((post) => ({
        slug: post.slug,
        slugEs: post.slug_es ?? null,
        lastModified: post.published_at
          ? post.published_at.split("T")[0]
          : undefined,
      }));
    } catch {
      return [];
    }
  },
  ["sitemap-blog-posts"],
  // Tagged so publishing a post can drop this cache immediately, rather than
  // leaving the sitemaps an hour behind the blog itself.
  { revalidate: 3600, tags: [BLOG_POSTS_CACHE_TAG] },
);
