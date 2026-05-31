import {
  siteBase,
  staticRoutes,
  getTreatmentPaths,
  fetchBlogPosts,
} from "@/lib/sitemap-data";

export const revalidate = 3600;

function urlEntry(
  enPath: string,
  esPath: string,
  lastMod?: Date,
  changefreq?: string,
  priority?: number,
) {
  const enUrl = `${siteBase}${enPath}`;
  const esUrl = `${siteBase}/es${esPath}`;
  const lastModStr = lastMod
    ? `\n    <lastmod>${lastMod.toISOString().split("T")[0]}</lastmod>`
    : "";
  const changefreqStr = changefreq
    ? `\n    <changefreq>${changefreq}</changefreq>`
    : "";
  const priorityStr =
    priority !== undefined ? `\n    <priority>${priority}</priority>` : "";
  return `
  <url>
    <loc>${enUrl}</loc>
    <x:link rel="alternate" hreflang="en" href="${enUrl}"/>
    <x:link rel="alternate" hreflang="es" href="${esUrl}"/>
    <x:link rel="alternate" hreflang="x-default" href="${enUrl}"/>${lastModStr}${changefreqStr}${priorityStr}
  </url>`;
}

export async function GET() {
  const blogPosts = await fetchBlogPosts();

  const staticEntries = staticRoutes
    .map((r) =>
      urlEntry(r.path, r.esPath, undefined, r.changeFrequency, r.priority),
    )
    .join("");

  const treatmentEntries = getTreatmentPaths()
    .map(({ path, esPath }) =>
      urlEntry(path, esPath, undefined, "monthly", 0.7),
    )
    .join("");

  const blogEntries = blogPosts
    .map((post) =>
      urlEntry(
        `/blog/${post.slug}`,
        `/blog/${post.slugEs ?? post.slug}`,
        post.lastModified,
        "monthly",
        0.6,
      ),
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:x="http://www.w3.org/1999/xhtml">${staticEntries}${treatmentEntries}${blogEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
