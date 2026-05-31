import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { marked } from "marked";
import { getTranslations } from "next-intl/server";
import { createClient } from "@insforge/sdk";
import { contact } from "@/constants/contact";
import { breadcrumbSchema } from "@/lib/seo";
import Newsletter from "@/components/sections/newsletter";
import { getOgImage } from "@/constants/metadata";

export const revalidate = 3600;
export const dynamicParams = true;

const db = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});

const SELECT_FIELDS =
  "id, title, slug, slug_es, excerpt, content, title_es, excerpt_es, content_es, cover_image_url, published_at, seo_title, seo_description, seo_og_image_url, seo_title_es, seo_description_es, category:blog_categories(name, slug, name_es), author:profiles(full_name)";

type Post = {
  id: string;
  title: string;
  slug: string;
  slug_es: string | null;
  excerpt: string | null;
  content: string | null;
  title_es: string | null;
  excerpt_es: string | null;
  content_es: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_og_image_url: string | null;
  seo_title_es: string | null;
  seo_description_es: string | null;
  category: { name: string; slug: string; name_es: string | null } | null;
  author: { full_name: string | null } | null;
};

function normalizePost(data: Record<string, unknown>): Post {
  const raw = data as Record<string, unknown>;
  return {
    ...raw,
    category: Array.isArray(raw.category)
      ? (raw.category[0] ?? null)
      : (raw.category as Post["category"]),
    author: Array.isArray(raw.author)
      ? (raw.author[0] ?? null)
      : (raw.author as Post["author"]),
  } as Post;
}

async function getPost(slug: string, locale: string): Promise<Post | null> {
  if (locale === "es") {
    const { data } = await db.database
      .from("blog_posts")
      .select(SELECT_FIELDS)
      .eq("slug_es", slug)
      .eq("status", "published")
      .single();
    if (data) return normalizePost(data as Record<string, unknown>);
  }
  const { data } = await db.database
    .from("blog_posts")
    .select(SELECT_FIELDS)
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return data ? normalizePost(data as Record<string, unknown>) : null;
}

function formatDate(iso: string | null, locale: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateStaticParams() {
  try {
    const { data } = await db.database
      .from("blog_posts")
      .select("slug, slug_es")
      .eq("status", "published");
    const posts = (data as { slug: string; slug_es: string | null }[]) ?? [];
    return posts.flatMap((post) => [
      { locale: "en", slug: post.slug },
      { locale: "es", slug: post.slug_es ?? post.slug },
    ]);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const t = await getTranslations("blog.post");
  const post = await getPost(slug, locale);
  if (!post) return { title: t("notFound") };

  const isEs = locale === "es";
  const title = isEs
    ? (post.seo_title_es ?? post.title_es ?? post.title)
    : (post.seo_title ?? post.title);
  const description = isEs
    ? (post.seo_description_es ?? post.excerpt_es ?? post.excerpt ?? undefined)
    : (post.seo_description ?? post.excerpt ?? undefined);
  const image = post.seo_og_image_url ?? post.cover_image_url ?? undefined;

  return {
    title: `${title} | ${t("titleSuffix")}`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      images: image ? [{ url: image }] : getOgImage(locale),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations("blog.post");
  const post = await getPost(slug, locale);
  if (!post) notFound();

  const isEs = locale === "es";

  const displayTitle = isEs ? (post.title_es ?? post.title) : post.title;
  const displayExcerpt = isEs
    ? (post.excerpt_es ?? post.excerpt)
    : post.excerpt;
  const rawContent = isEs ? (post.content_es ?? post.content) : post.content;
  const displayCategory = isEs
    ? (post.category?.name_es ?? post.category?.name)
    : post.category?.name;

  const html = rawContent ? await marked(rawContent) : "";

  const siteUrl = `https://${contact.domain}`;
  const canonicalSlug = isEs ? (post.slug_es ?? post.slug) : post.slug;
  const canonicalPath = isEs
    ? `/es/blog/${canonicalSlug}`
    : `/blog/${post.slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: displayTitle,
    description: displayExcerpt ?? undefined,
    image: post.seo_og_image_url ?? post.cover_image_url ?? undefined,
    datePublished: post.published_at ?? undefined,
    author: {
      "@type": "Person",
      name: post.author?.full_name ?? t("defaultAuthor"),
    },
    publisher: {
      "@type": "Organization",
      name: "Essentia",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/logo.webp` },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}${canonicalPath}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: t("breadcrumbHome"), url: "/" },
              { name: t("breadcrumbBlog"), url: "/blog" },
              { name: displayTitle, url: canonicalPath },
            ]),
          ),
        }}
      />
      <article className="bg-sand-50 text-petroleum-700 px-4 pt-36 pb-20 sm:px-8 lg:pt-48">
        <div className="mx-auto max-w-3xl">
          {displayCategory && (
            <span className="bg-petroleum-50 text-petroleum-500 mb-4 inline-block rounded-full px-3 py-1 text-xs font-medium">
              {displayCategory}
            </span>
          )}

          <h1 className="font-display text-petroleum-700 mb-4 text-4xl leading-tight sm:text-5xl">
            {displayTitle}
          </h1>

          <div className="text-petroleum-400 mb-8 flex flex-wrap items-center gap-3 text-sm">
            {post.author?.full_name && <span>{post.author.full_name}</span>}
            {post.author?.full_name && post.published_at && <span>·</span>}
            {post.published_at && (
              <span>{formatDate(post.published_at, locale)}</span>
            )}
          </div>

          {post.cover_image_url && (
            <div className="mb-10 overflow-hidden rounded-2xl">
              <Image
                src={post.cover_image_url}
                alt={displayTitle}
                width={896}
                height={504}
                unoptimized
                className="h-auto w-full object-cover"
              />
            </div>
          )}

          {displayExcerpt && (
            <p className="text-petroleum-500 border-petroleum-100 mb-8 border-l-2 pl-4 text-lg leading-relaxed italic">
              {displayExcerpt}
            </p>
          )}

          {html && (
            <div
              className="prose prose-lg prose-headings:font-display max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </article>
      <Newsletter />
    </>
  );
}
