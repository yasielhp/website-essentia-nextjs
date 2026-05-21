import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { marked } from "marked";
import { createClient } from "@insforge/sdk";
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post no encontrado | Essentia Blog" };

  const title = post.seo_title ?? post.title;
  const description = post.seo_description ?? post.excerpt ?? undefined;
  const image = post.seo_og_image_url ?? post.cover_image_url ?? undefined;

  return {
    title: `${title} | Essentia Blog`,
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

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const html = post.content ? await marked(post.content) : "";

  return (
    <>
      <article className="bg-sand-50 text-primary px-4 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Breadcrumb */}
          <nav className="mb-8 text-sm">
            <Link
              href="/blog"
              className="text-primary/50 hover:text-primary transition-colors"
            >
              Blog
            </Link>
            {post.category && (
              <>
                <span className="text-primary/30 mx-2">/</span>
                <span className="text-primary/50">{post.category.name}</span>
              </>
            )}
          </nav>

          {/* Category badge */}
          {post.category && (
            <span className="bg-primary/10 text-primary mb-4 inline-block rounded-full px-3 py-1 text-xs font-medium">
              {post.category.name}
            </span>
          )}

          {/* Title */}
          <h1 className="font-display mb-4 text-4xl leading-tight sm:text-5xl">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="text-primary/50 mb-8 flex flex-wrap items-center gap-3 text-sm">
            {post.author?.full_name && <span>{post.author.full_name}</span>}
            {post.author?.full_name && post.published_at && <span>·</span>}
            {post.published_at && <span>{formatDate(post.published_at)}</span>}
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
            <p className="text-primary/70 border-primary/20 mb-8 border-l-2 pl-4 text-lg leading-relaxed italic">
              {post.excerpt}
            </p>
          )}

          {/* Content */}
          {html && (
            <div
              className="prose prose-lg prose-headings:font-display prose-headings:text-primary prose-p:text-primary/80 prose-a:text-primary prose-strong:text-primary max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

        </div>
      </article>
      <Newsletter />
    </>
  );
}
