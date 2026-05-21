"use client";

import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import { IconTrash } from "@/components/ui/icons";

type Category = { id: string; name: string; slug: string; created_at: string };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function BlogCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const { data } = await insforge.database
      .from("blog_categories")
      .select("id, name, slug, created_at")
      .order("name");
    setCategories((data as Category[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    insforge.database
      .from("blog_categories")
      .select("id, name, slug, created_at")
      .order("name")
      .then(({ data }) => {
        setCategories((data as Category[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  function handleNameChange(val: string) {
    setName(val);
    setSlug(slugify(val));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !slug.trim()) {
      setError("Nombre y slug son obligatorios.");
      return;
    }
    setSaving(true);
    const { error: err } = await insforge.database
      .from("blog_categories")
      .insert([{ name: name.trim(), slug: slug.trim() }]);
    setSaving(false);
    if (err) {
      setError((err as { message?: string }).message ?? "Error al crear.");
      return;
    }
    setName("");
    setSlug("");
    void reload();
  }

  async function handleDelete(id: string) {
    await insforge.database.from("blog_categories").delete().eq("id", id);
    void reload();
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="md" href="/dashboard/blog">
          ← Blog
        </Button>
        <h1 className="font-display text-petroleum-700 text-3xl">Categorías</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Add category */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            Nueva categoría
          </h2>
          {error && (
            <p className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <form onSubmit={(e) => void handleAdd(e)} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-petroleum-500 text-xs font-medium">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Longevidad"
                disabled={saving}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-petroleum-500 text-xs font-medium">
                Slug <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="longevidad"
                disabled={saving}
                className={INPUT_CLASS}
              />
            </div>
            <Button type="submit" variant="solid" size="md" disabled={saving}>
              {saving ? "Creando…" : "Añadir categoría"}
            </Button>
          </form>
        </div>

        {/* List */}
        <div className="border-sand-200 rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-sand-200 border-b text-left">
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Nombre
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Slug
                  </th>
                  <th className="text-petroleum-400 w-10 px-5 py-3.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-sand-50 border-b">
                      {[1, 2, 3].map((j) => (
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
                      Sin categorías.
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c.id} className="border-sand-50 border-b">
                      <td className="text-petroleum-700 px-5 py-3.5 font-medium">
                        {c.name}
                      </td>
                      <td className="text-petroleum-400 px-5 py-3.5 font-mono text-xs">
                        {c.slug}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => void handleDelete(c.id)}
                          className="text-petroleum-300 transition-colors hover:text-red-500"
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
