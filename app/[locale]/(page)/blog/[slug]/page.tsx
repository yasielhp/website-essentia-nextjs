import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { marked } from "marked";
import { getTranslations } from "next-intl/server";
import { createClient } from "@insforge/sdk";
import { contact } from "@/constants/contact";
import { breadcrumbSchema } from "@/lib/seo";
import Newsletter from "@/components/sections/newsletter";

// Server-side client (anon key — RLS allows reading published posts)
const db = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_og_image_url: string | null;
  category: { name: string; slug: string } | null;
  author: { full_name: string | null } | null;
};

async function getPost(slug: string): Promise<Post | null> {
  const { data } = await db.database
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, content, cover_image_url, published_at, seo_title, seo_description, seo_og_image_url, category:blog_categories(name, slug), author:profiles(full_name)",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  return (data as Post | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("blog.post");
  const post = await getPost(slug);
  if (!post) return { title: t("notFound") };

  const title = post.seo_title ?? post.title;
  const description = post.seo_description ?? post.excerpt ?? undefined;
  const image = post.seo_og_image_url ?? post.cover_image_url ?? undefined;

  return {
    title: `${title} | ${t("titleSuffix")}`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

function formatDate(iso: string | null, locale: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations("blog.post");
  const post = await getPost(slug);
  if (!post) notFound();

  const html = post.content ? await marked(post.content) : "";

  const siteUrl = `https://${contact.domain}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seo_title ?? post.title,
    description: post.seo_description ?? post.excerpt ?? undefined,
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
      "@id": `${siteUrl}/blog/${post.slug}`,
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
              { name: post.title, url: `/blog/${post.slug}` },
            ]),
          ),
        }}
      />
      <article className="bg-sand-50 text-petroleum-700 px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Category badge */}
          {post.category && (
            <span className="bg-petroleum-50 text-petroleum-500 mb-4 inline-block rounded-full px-3 py-1 text-xs font-medium">
              {post.category.name}
            </span>
          )}

          {/* Title */}
          <h1 className="font-display text-petroleum-700 mb-4 text-4xl leading-tight sm:text-5xl">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="text-petroleum-400 mb-8 flex flex-wrap items-center gap-3 text-sm">
            {post.author?.full_name && <span>{post.author.full_name}</span>}
            {post.author?.full_name && post.published_at && <span>·</span>}
            {post.published_at && (
              <span>{formatDate(post.published_at, locale)}</span>
            )}
          </div>

          {/* Cover image */}
          {post.cover_image_url && (
            <div className="mb-10 overflow-hidden rounded-2xl">
              <Image
                src={post.cover_image_url}
                alt={post.title}
                width={896}
                height={504}
                unoptimized
                className="h-auto w-full object-cover"
              />
            </div>
          )}

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-petroleum-500 border-petroleum-100 mb-8 border-l-2 pl-4 text-lg leading-relaxed italic">
              {post.excerpt}
            </p>
          )}

          {/* Content */}
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
