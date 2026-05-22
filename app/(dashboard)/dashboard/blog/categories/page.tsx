"use client";

import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import { IconTrash } from "@/components/ui/icons";

type Category = {
  id: string;
  name: string;
  slug: string;
  name_es: string | null;
  slug_es: string | null;
  created_at: string;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeSlug(val: string): string {
  return val
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-");
}

const TAB_BTN = (active: boolean) =>
  [
    "rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
    active
      ? "bg-white text-petroleum-700 shadow-sm"
      : "text-petroleum-400 hover:text-petroleum-600",
  ].join(" ");

export default function BlogCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"en" | "es">("en");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [nameEs, setNameEs] = useState("");
  const [slugEs, setSlugEs] = useState("");

  const [editing, setEditing] = useState<Category | null>(null);

  async function reload() {
    const { data } = await insforge.database
      .from("blog_categories")
      .select("id, name, slug, name_es, slug_es, created_at")
      .order("name");
    setCategories((data as Category[] | null) ?? []);
  }

  useEffect(() => {
    insforge.database
      .from("blog_categories")
      .select("id, name, slug, name_es, slug_es, created_at")
      .order("name")
      .then(({ data }) => {
        setCategories((data as Category[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  function startEdit(cat: Category) {
    setEditing(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setNameEs(cat.name_es ?? "");
    setSlugEs(cat.slug_es ?? "");
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setName("");
    setSlug("");
    setNameEs("");
    setSlugEs("");
    setError(null);
  }

  function handleNameChange(val: string) {
    setName(val);
    if (!editing) setSlug(slugify(val));
  }

  function handleNameEsChange(val: string) {
    setNameEs(val);
    if (!editing) setSlugEs(slugify(val));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !slug.trim() || !nameEs.trim() || !slugEs.trim()) {
      setError("Name and slug are required in both languages.");
      return;
    }
    setSaving(true);

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      name_es: nameEs.trim() || null,
      slug_es: slugEs.trim() || null,
    };

    if (editing) {
      const { error: err } = await insforge.database
        .from("blog_categories")
        .update(payload)
        .eq("id", editing.id);
      setSaving(false);
      if (err) {
        setError((err as { message?: string }).message ?? "Failed to save.");
        return;
      }
      cancelEdit();
    } else {
      const { error: err } = await insforge.database
        .from("blog_categories")
        .insert([payload]);
      setSaving(false);
      if (err) {
        setError((err as { message?: string }).message ?? "Failed to create.");
        return;
      }
      setName("");
      setSlug("");
      setNameEs("");
      setSlugEs("");
    }

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
        <h1 className="font-display text-petroleum-700 text-3xl">Categories</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Add / Edit form */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-petroleum-500 text-sm font-semibold">
              {editing ? "Edit category" : "New category"}
            </h2>
            <div className="bg-sand-100 flex gap-1 rounded-lg p-1">
              {(["en", "es"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={TAB_BTN(lang === l)}
                >
                  {l === "en" ? "English" : "Español"}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {lang === "en" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Longevity"
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
                    onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                    placeholder="longevity"
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={nameEs}
                    onChange={(e) => handleNameEsChange(e.target.value)}
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
                    value={slugEs}
                    onChange={(e) => setSlugEs(sanitizeSlug(e.target.value))}
                    placeholder="longevidad"
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button type="submit" variant="solid" size="md" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* List */}
        <div className="border-sand-200 rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-sand-200 border-b text-left">
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Name
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Slug
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
                      No categories yet.
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr
                      key={c.id}
                      className={[
                        "border-sand-50 border-b",
                        editing?.id === c.id ? "bg-sand-50" : "",
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
                            onClick={() => startEdit(c)}
                            className="text-petroleum-300 hover:text-petroleum-600 text-xs transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void handleDelete(c.id)}
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
      </div>
    </div>
  );
}
