"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { insforge } from "@/lib/insforge";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  category: { name: string; slug: string } | null;
};

type Category = { id: string; name: string; slug: string };

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function SkeletonCard() {
  return (
    <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
      <div className="bg-sand-100 aspect-video w-full animate-pulse" />
      <div className="space-y-3 p-5">
        <div className="bg-sand-200 h-3 w-20 animate-pulse rounded-full" />
        <div className="bg-sand-200 h-5 animate-pulse rounded" />
        <div className="bg-sand-200 h-4 animate-pulse rounded" />
        <div className="bg-sand-200 h-4 w-3/4 animate-pulse rounded" />
      </div>
    </div>
  );
}

export default function PostsSection() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    insforge.database
      .from("blog_categories")
      .select("id, name, slug")
      .order("name")
      .then(({ data }) => setCategories((data as Category[] | null) ?? []));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const q = insforge.database
        .from("blog_posts")
        .select(
          "id, title, slug, excerpt, cover_image_url, published_at, category:blog_categories(name, slug)",
        )
        .eq("status", "published")
        .order("published_at", { ascending: false });

      const { data } = await (activeCategory
        ? q.eq("category_id", activeCategory)
        : q);
      setPosts((data as Post[] | null) ?? []);
      setLoading(false);
    }
    void load();
  }, [activeCategory]);

  // Animar cards cuando aparecen
  useEffect(() => {
    if (loading || !gridRef.current) return;
    const cards = Array.from(gridRef.current.children);
    if (!cards.length) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.07, duration: 0.5, ease: "power2.out" },
    );
  }, [loading, posts]);

  return (
    <section id="posts" className="bg-sand-50 px-5 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        {/* Filtros de categoría */}
        {categories.length > 0 && (
          <div className="mb-12 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === null
                  ? "bg-petroleum-700 text-white"
                  : "bg-sand-200 text-petroleum-500 hover:bg-sand-200"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === c.id
                    ? "bg-petroleum-700 text-white"
                    : "bg-sand-200 text-petroleum-500 hover:bg-sand-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Grid de posts */}
        {loading ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-petroleum-400 py-20 text-center text-sm">
            No articles published yet.
          </p>
        ) : (
          <div
            ref={gridRef}
            className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
          >
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                className="group border-sand-200 overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-md"
              >
                {p.cover_image_url ? (
                  <div className="aspect-video w-full overflow-hidden">
                    <Image
                      src={p.cover_image_url}
                      alt={p.title}
                      width={640}
                      height={360}
                      unoptimized
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="bg-sand-100 aspect-video w-full" />
                )}
                <div className="p-5">
                  {p.category && (
                    <span className="bg-sand-100 text-petroleum-500 mb-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {p.category.name}
                    </span>
                  )}
                  <h2 className="text-petroleum-700 mb-2 text-base leading-snug font-semibold group-hover:underline group-hover:underline-offset-2">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="text-petroleum-400 mb-4 line-clamp-2 text-sm leading-relaxed">
                      {p.excerpt}
                    </p>
                  )}
                  {p.published_at && (
                    <p className="text-petroleum-300 text-xs">
                      {formatDate(p.published_at)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
