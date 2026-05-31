import { unstable_cache } from "next/cache";
import { createClient } from "@insforge/sdk";
import { manualTherapyTreatments } from "@/data/services-data";
import { contact } from "@/constants/contact";

export const siteBase =
  process.env.NEXT_PUBLIC_APP_URL ?? `https://${contact.domain}`;

export const staticRoutes = [
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
    path: "/wellness/functional-well-being",
    esPath: "/bienestar/bienestar-funcional",
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
    path: "/community",
    esPath: "/comunidad",
    priority: 0.8,
    changeFrequency: "weekly",
  },
  {
    path: "/community/memberships",
    esPath: "/comunidad/membresias",
    priority: 0.85,
    changeFrequency: "weekly",
  },
  {
    path: "/community/running-club",
    esPath: "/comunidad/running-club",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/community/education-programs",
    esPath: "/comunidad/programas-educativos",
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

export function getTreatmentPaths(): { path: string; esPath: string }[] {
  return manualTherapyTreatments.map((t) => ({
    path: `/wellness/manual-therapies/${t.id}`,
    esPath: `/bienestar/terapias-manuales/${t.id}`,
  }));
}

export type BlogPost = {
  slug: string;
  slugEs: string | null;
  lastModified?: Date;
};

export const fetchBlogPosts = unstable_cache(
  async (): Promise<BlogPost[]> => {
    try {
      const db = createClient({
        baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
        anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
      });
      const { data } = await db.database
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
          ? new Date(post.published_at)
          : undefined,
      }));
    } catch {
      return [];
    }
  },
  ["sitemap-blog-posts"],
  { revalidate: 3600 },
);
