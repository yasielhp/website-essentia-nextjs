"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

type Post = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  category: { name: string } | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function BlogDashboardPage() {
  const { push } = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    insforge.database
      .from("blog_posts")
      .select(
        "id, title, slug, status, published_at, created_at, category:blog_categories(name)",
      )
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPosts((data as Post[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">Blog</h1>
          {!loading && (
            <p className="text-petroleum-400 mt-1 text-sm">
              {posts.length} post{posts.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="md" href="/dashboard/blog/categories">
            Categorías
          </Button>
          <Button
            variant="solid"
            size="md"
            href="/dashboard/blog/new"
            className="gap-2 self-start"
          >
            <IconPlus />
            Nuevo post
          </Button>
        </div>
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Título
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Categoría
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Estado
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Publicado
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Creado
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="bg-sand-100 h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : posts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No hay posts todavía.
                  </td>
                </tr>
              ) : (
                posts.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => push(`/dashboard/blog/${p.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {p.title}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {p.category?.name ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      {p.status === "published" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          <span className="size-1.5 rounded-full bg-green-500" />
                          Publicado
                        </span>
                      ) : (
                        <span className="bg-sand-100 text-petroleum-500 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
                          <span className="bg-petroleum-300 size-1.5 rounded-full" />
                          Borrador
                        </span>
                      )}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {formatDate(p.published_at)}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
