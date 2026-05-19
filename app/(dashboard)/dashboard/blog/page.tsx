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

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

type BlogFilter = { status: string; category: string };
const emptyBlogFilter: BlogFilter = { status: "", category: "" };

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

function IconFilter() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterModal({
  pending,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  pending: BlogFilter;
  onChange: (key: keyof BlogFilter, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    void insforge.database
      .from("blog_categories")
      .select("name")
      .order("name")
      .then(({ data }) => {
        setCategories(((data ?? []) as { name: string }[]).map((c) => c.name));
      });
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-petroleum-700 text-xl">Filters</h3>
          <button
            onClick={onClose}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              Status
            </span>
            <select
              value={pending.status}
              onChange={(e) => onChange("status", e.target.value)}
              className={fieldCls}
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              Category
            </span>
            <select
              value={pending.category}
              onChange={(e) => onChange("category", e.target.value)}
              className={fieldCls}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onClear}
            className="text-petroleum-400 hover:text-petroleum-700 text-sm transition-colors"
          >
            Clear all
          </button>
          <Button variant="solid" size="md" onClick={onApply}>
            Apply filters
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BlogDashboardPage() {
  const { push } = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [appliedFilter, setAppliedFilter] =
    useState<BlogFilter>(emptyBlogFilter);
  const [pendingFilter, setPendingFilter] =
    useState<BlogFilter>(emptyBlogFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = Object.values(appliedFilter).filter(Boolean).length;

  function openModal() {
    setPendingFilter(appliedFilter);
    setFilterOpen(true);
  }
  function applyFilters() {
    setAppliedFilter(pendingFilter);
    setFilterOpen(false);
  }
  function clearFilters() {
    setAppliedFilter(emptyBlogFilter);
    setPendingFilter(emptyBlogFilter);
    setFilterOpen(false);
  }

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

  const filteredPosts = posts.filter((p) => {
    if (appliedFilter.status && p.status !== appliedFilter.status) return false;
    if (appliedFilter.category && p.category?.name !== appliedFilter.category)
      return false;
    return true;
  });

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="solid"
            size="md"
            href="/dashboard/blog/new"
            className="gap-2"
          >
            <IconPlus />
            Nuevo post
          </Button>
          <Button variant="outline" size="md" href="/dashboard/blog/categories">
            Categorías
          </Button>
        </div>
        <Button
          variant={activeFilterCount > 0 ? "soft" : "outline"}
          size="md"
          onClick={openModal}
          className="gap-2"
        >
          <IconFilter />
          Filters{activeFilterCount > 0 ? ` [${activeFilterCount}]` : ""}
        </Button>
      </div>

      {/* Mobile cards */}
      <div className="border-sand-200 divide-sand-200 divide-y overflow-hidden rounded-2xl border bg-white sm:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
              </div>
              <div className="bg-sand-100 mt-1.5 h-3 w-32 animate-pulse rounded" />
            </div>
          ))
        ) : filteredPosts.length === 0 ? (
          <p className="text-petroleum-400 px-6 py-12 text-center text-sm">
            No hay posts todavía.
          </p>
        ) : (
          filteredPosts.map((p) => (
            <div
              key={p.id}
              onClick={() => push(`/dashboard/blog/${p.id}`)}
              className="hover:bg-sand-50 cursor-pointer px-5 py-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-petroleum-700 truncate font-medium">
                  {p.title}
                </p>
                {p.status === "published" ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    Publicado
                  </span>
                ) : (
                  <span className="bg-sand-100 text-petroleum-500 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    <span className="bg-petroleum-300 size-1.5 rounded-full" />
                    Borrador
                  </span>
                )}
              </div>
              <p className="text-petroleum-400 mt-1 text-xs">
                {p.category?.name ?? "Sin categoría"}
                {p.published_at
                  ? ` · Publicado ${formatDate(p.published_at)}`
                  : ` · Creado ${formatDate(p.created_at)}`}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Table (desktop only) */}
      <div className="border-sand-200 hidden rounded-2xl border bg-white sm:block">
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
                    {/* Título */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-48 animate-pulse rounded" />
                    </td>
                    {/* Categoría */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-28 animate-pulse rounded" />
                    </td>
                    {/* Estado (badge with dot) */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-5 w-24 animate-pulse rounded-full" />
                    </td>
                    {/* Publicado */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                    </td>
                    {/* Creado */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              ) : filteredPosts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No hay posts todavía.
                  </td>
                </tr>
              ) : (
                filteredPosts.map((p) => (
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

      {filterOpen && (
        <FilterModal
          pending={pendingFilter}
          onChange={(key, val) =>
            setPendingFilter((p) => ({ ...p, [key]: val }))
          }
          onApply={applyFilters}
          onClear={clearFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
