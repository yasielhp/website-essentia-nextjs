"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

export function BlogList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    insforge.database
      .from("blog_categories")
      .select("id, name, slug")
      .order("name")
      .then(({ data }) => setCategories((data as Category[] | null) ?? []));
  }, []);

  useEffect(() => {
    const q = insforge.database
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, cover_image_url, published_at, category:blog_categories(name, slug)",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false });

    (activeCategory ? q.eq("category_id", activeCategory) : q).then(
      ({ data }) => {
        setPosts((data as Post[] | null) ?? []);
        setLoading(false);
      },
    );
  }, [activeCategory]);

  return (
    <section className="text-primary min-h-dvh px-4 py-20 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="font-display xs:text-7xl text-5xl">Blog</h1>
          <p className="text-primary/60 mt-4 text-lg">
            Artículos, guías y recursos sobre bienestar, salud y longevidad.
          </p>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="mb-10 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeCategory === null ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/15"}`}
            >
              Todos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeCategory === c.id ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/15"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Posts grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-primary/5 animate-pulse overflow-hidden rounded-2xl p-0"
              >
                <div className="bg-primary/10 h-48 w-full" />
                <div className="space-y-3 p-5">
                  <div className="bg-primary/10 h-3 w-20 rounded" />
                  <div className="bg-primary/10 h-5 rounded" />
                  <div className="bg-primary/10 h-4 rounded" />
                  <div className="bg-primary/10 h-4 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-primary/40 py-20 text-center">
            No hay artículos publicados todavía.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                className="group border-primary/10 overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-lg"
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
                  <div className="from-primary/10 to-primary/5 aspect-video w-full bg-gradient-to-br" />
                )}
                <div className="p-5">
                  {p.category && (
                    <span className="bg-primary/10 text-primary mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium">
                      {p.category.name}
                    </span>
                  )}
                  <h2 className="text-primary mb-2 text-lg leading-snug font-semibold group-hover:underline group-hover:underline-offset-2">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="text-primary/60 mb-3 line-clamp-2 text-sm">
                      {p.excerpt}
                    </p>
                  )}
                  {p.published_at && (
                    <p className="text-primary/40 text-xs">
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
