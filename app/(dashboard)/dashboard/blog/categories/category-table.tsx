"use client";

import { useTranslations } from "next-intl";
import { IconTrash } from "@/components/ui/icons";
import type { Category } from "./types";

/**
 * The categories that exist, and what can be done to each.
 *
 * It shared a file with the form that creates them, which meant the screen was
 * two unrelated things: a form and a table.
 */
export function CategoryTable({
  categories,
  loading,
  editingId,
  onEdit,
  onDelete,
}: {
  categories: Category[];
  loading: boolean;
  editingId: string | null;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("dashboard.blog.categories_page");

  return (
    <div className="border-sand-200 rounded-2xl border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-sand-200 border-b text-left">
              <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                {t("columns.name")}
              </th>
              <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                {t("columns.slug")}
              </th>
              <th className="text-petroleum-400 w-20 px-5 py-3.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-sand-50 border-b">
                  {[1, 2, 3, 4].map((j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="bg-sand-100 h-4 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : categories.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="text-petroleum-400 px-6 py-8 text-center text-sm"
                >
                  {t("empty")}
                </td>
              </tr>
            ) : (
              categories.map((c) => (
                <tr
                  key={c.id}
                  className={[
                    "border-sand-50 border-b",
                    editingId === c.id ? "bg-sand-50" : "",
                  ].join(" ")}
                >
                  <td className="text-petroleum-700 px-5 py-3.5 font-medium">
                    {c.name}
                    {c.name_es && (
                      <span className="text-petroleum-300 ml-1 font-normal">
                        / {c.name_es}
                      </span>
                    )}
                  </td>
                  <td className="text-petroleum-400 px-5 py-3.5 font-mono text-xs">
                    {c.slug}
                    {c.slug_es && (
                      <span className="text-petroleum-300 ml-1">
                        / {c.slug_es}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit(c)}
                        className="text-petroleum-300 hover:text-petroleum-600 text-xs transition-colors"
                      >
                        {t("edit")}
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        aria-label={`${t("delete")} — ${c.name}`}
                        className="text-petroleum-300 transition-colors hover:text-red-500"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
