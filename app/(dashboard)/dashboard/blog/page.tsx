"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAsyncData } from "@/hooks/use-async-data";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { IconPlus, IconFilter } from "@/components/ui/icons";
import { formatMediumDate } from "@/utils/format";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { activatable } from "@/lib/a11y";

type Post = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  category: { name: string } | null;
};

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

type BlogFilter = { status: string; category: string };
const emptyBlogFilter: BlogFilter = { status: "", category: "" };

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
  const t = useTranslations("dashboard");
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
      // Decorative: the click that closes is a convenience for a mouse. The
      // dialog itself is the element inside, and Escape closes it too.
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("common.filters")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
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
              {t("blog.filters.status")}
            </span>
            <select
              value={pending.status}
              onChange={(e) => onChange("status", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("blog.filters.allStatuses")}</option>
              <option value="published">{t("blog.status.published")}</option>
              <option value="draft">{t("blog.status.draft")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("blog.filters.category")}
            </span>
            <select
              value={pending.category}
              onChange={(e) => onChange("category", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("blog.filters.allCategories")}</option>
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
            {t("common.clearAll")}
          </button>
          <Button variant="solid" size="md" onClick={onApply}>
            {t("common.applyFilters")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BlogDashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useDashboardLocale();
  const { push } = useRouter();
  const fetchPosts = useCallback(async (): Promise<Post[]> => {
    const { data } = await insforge.database
      .from("blog_posts")
      .select(
        "id, title, slug, status, published_at, created_at, category:blog_categories(name)",
      )
      .order("created_at", { ascending: false });
    return (data as Post[] | null) ?? [];
  }, []);

  const { data: posts, loading } = useAsyncData<Post[]>(fetchPosts, []);

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
            {t("blog.newPost")}
          </Button>
          <Button variant="outline" size="md" href="/dashboard/blog/categories">
            {t("blog.categories")}
          </Button>
        </div>
        <Button
          variant={activeFilterCount > 0 ? "soft" : "outline"}
          size="md"
          onClick={openModal}
          className="gap-2"
        >
          <IconFilter />
          {activeFilterCount > 0
            ? t("common.filtersWithCount", { count: activeFilterCount })
            : t("common.filters")}
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
            {t("blog.empty")}
          </p>
        ) : (
          filteredPosts.map((p) => (
            <div
              key={p.id}
              {...activatable(() => push(`/dashboard/blog/${p.id}`))}
              className="hover:bg-sand-50 cursor-pointer px-5 py-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-petroleum-700 truncate font-medium">
                  {p.title}
                </p>
                {p.status === "published" ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    {t("blog.status.published")}
                  </span>
                ) : (
                  <span className="bg-sand-100 text-petroleum-500 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    <span className="bg-petroleum-300 size-1.5 rounded-full" />
                    {t("blog.status.draft")}
                  </span>
                )}
              </div>
              <p className="text-petroleum-400 mt-1 text-xs">
                {p.category?.name ?? t("blog.noCategory")}
                {" · "}
                {p.published_at
                  ? t("blog.publishedOn", {
                      date: formatMediumDate(p.published_at, locale),
                    })
                  : t("blog.createdOn", {
                      date: formatMediumDate(p.created_at, locale),
                    })}
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
                  {t("blog.columns.title")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("blog.columns.category")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("blog.columns.status")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("blog.columns.published")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("blog.columns.created")}
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
                    {t("blog.empty")}
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
                      {/* Same destination as the row click, reachable by keyboard. */}
                      <Link
                        href={`/dashboard/blog/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded outline-offset-2"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {p.category?.name ?? t("common.empty")}
                    </td>
                    <td className="px-5 py-4">
                      {p.status === "published" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          <span className="size-1.5 rounded-full bg-green-500" />
                          {t("blog.status.published")}
                        </span>
                      ) : (
                        <span className="bg-sand-100 text-petroleum-500 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium">
                          <span className="bg-petroleum-300 size-1.5 rounded-full" />
                          {t("blog.status.draft")}
                        </span>
                      )}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {formatMediumDate(p.published_at, locale)}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {formatMediumDate(p.created_at, locale)}
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
