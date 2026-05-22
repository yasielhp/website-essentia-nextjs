"use client";

import { useEffect, useReducer, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { INPUT_CLASS, SELECT_CLASS } from "@/constants/form-styles";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type Category = { id: string; name: string };

type FormState = {
  saving: boolean;
  error: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  titleEs: string;
  excerptEs: string;
  contentEs: string;
  coverImageUrl: string;
  categoryId: string;
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  seoTitleEs: string;
  seoDescriptionEs: string;
};

type Action =
  | {
      type: "SET";
      field: keyof Omit<FormState, "saving" | "error">;
      value: string;
    }
  | { type: "SET_STATUS"; value: "draft" | "published" }
  | { type: "SAVING" }
  | { type: "ERROR"; msg: string }
  | { type: "DONE" };

const init: FormState = {
  saving: false,
  error: null,
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  titleEs: "",
  excerptEs: "",
  contentEs: "",
  coverImageUrl: "",
  categoryId: "",
  status: "draft",
  seoTitle: "",
  seoDescription: "",
  seoTitleEs: "",
  seoDescriptionEs: "",
};

function reducer(s: FormState, a: Action): FormState {
  switch (a.type) {
    case "SET":
      return { ...s, [a.field]: a.value };
    case "SET_STATUS":
      return { ...s, status: a.value };
    case "SAVING":
      return { ...s, saving: true, error: null };
    case "ERROR":
      return { ...s, saving: false, error: a.msg };
    case "DONE":
      return { ...s, saving: false };
    default:
      return s;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewPostPage() {
  const { push } = useRouter();
  const [state, dispatch] = useReducer(reducer, init);
  const [categories, setCategories] = useState<Category[]>([]);
  const {
    saving,
    error,
    title,
    slug,
    excerpt,
    content,
    titleEs,
    excerptEs,
    contentEs,
    coverImageUrl,
    categoryId,
    status,
    seoTitle,
    seoDescription,
    seoTitleEs,
    seoDescriptionEs,
  } = state;

  useEffect(() => {
    insforge.database
      .from("blog_categories")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCategories((data as Category[] | null) ?? []));
  }, []);

  function handleTitleChange(val: string) {
    dispatch({ type: "SET", field: "title", value: val });
    dispatch({ type: "SET", field: "slug", value: slugify(val) });
    if (!seoTitle) dispatch({ type: "SET", field: "seoTitle", value: val });
  }

  function set(
    field: keyof Omit<FormState, "saving" | "error">,
    value: string,
  ) {
    dispatch({ type: "SET", field, value });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      dispatch({ type: "ERROR", msg: "Title and slug are required." });
      return;
    }
    dispatch({ type: "SAVING" });

    const { error: err } = await insforge.database.from("blog_posts").insert([
      {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        content: content.trim() || null,
        title_es: titleEs.trim() || null,
        excerpt_es: excerptEs.trim() || null,
        content_es: contentEs.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        category_id: categoryId || null,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_title_es: seoTitleEs.trim() || null,
        seo_description_es: seoDescriptionEs.trim() || null,
        seo_og_image_url: coverImageUrl.trim() || null,
      },
    ]);

    if (err) {
      dispatch({
        type: "ERROR",
        msg: (err as { message?: string }).message ?? "Failed to save.",
      });
      return;
    }
    push("/dashboard/blog");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">New post</h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/blog">
              Cancel
            </Button>
            <Button type="submit" variant="solid" size="md" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main content — 2/3 */}
          <div className="space-y-6 lg:col-span-2">
            {/* English content */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Content (EN)
              </h2>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="My first article"
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Slug <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center">
                    <span className="text-petroleum-400 border-sand-200 bg-sand-50 rounded-l-xl border border-r-0 px-3 py-2.5 text-xs">
                      /blog/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => set("slug", e.target.value)}
                      placeholder="my-first-article"
                      disabled={saving}
                      className={`${INPUT_CLASS} rounded-l-none border-l-0`}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Excerpt
                  </label>
                  <textarea
                    value={excerpt}
                    onChange={(e) => set("excerpt", e.target.value)}
                    placeholder="Brief description of the article…"
                    rows={2}
                    disabled={saving}
                    className={`${INPUT_CLASS} resize-y`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 mb-1 text-xs font-medium">
                    Content
                  </label>
                  <div data-color-mode="light">
                    <MDEditor
                      value={content}
                      onChange={(val) => set("content", val ?? "")}
                      height={480}
                      preview="edit"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Spanish content */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
                Content (ES)
              </h2>
              <p className="text-petroleum-400 mb-4 text-xs">
                Optional Spanish translation.
              </p>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Título
                  </label>
                  <input
                    type="text"
                    value={titleEs}
                    onChange={(e) => set("titleEs", e.target.value)}
                    placeholder="Mi primer artículo"
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Extracto
                  </label>
                  <textarea
                    value={excerptEs}
                    onChange={(e) => set("excerptEs", e.target.value)}
                    placeholder="Breve descripción del artículo…"
                    rows={2}
                    disabled={saving}
                    className={`${INPUT_CLASS} resize-y`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 mb-1 text-xs font-medium">
                    Contenido
                  </label>
                  <div data-color-mode="light">
                    <MDEditor
                      value={contentEs}
                      onChange={(val) => set("contentEs", val ?? "")}
                      height={480}
                      preview="edit"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar — 1/3 */}
          <div className="space-y-6">
            {/* Status */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Status
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(["draft", "published"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => dispatch({ type: "SET_STATUS", value: s })}
                    disabled={saving}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${status === s ? "border-petroleum-400 bg-petroleum-50 text-petroleum-700" : "border-sand-200 text-petroleum-400 hover:border-sand-300 hover:bg-sand-50"}`}
                  >
                    {s === "draft" ? "Draft" : "Published"}
                  </button>
                ))}
              </div>
            </div>

            {/* Featured image */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Featured image
              </h2>
              <ImageUpload
                apiEndpoint="/api/blog/upload"
                folder="covers"
                value={coverImageUrl || undefined}
                onChange={(url) => set("coverImageUrl", url)}
              />
            </div>

            {/* Category */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Category
              </h2>
              <select
                value={categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                disabled={saving}
                className={SELECT_CLASS}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* SEO EN */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
                SEO (EN)
              </h2>
              <p className="text-petroleum-400 mb-4 text-xs">
                How it appears in search engines and social media.
              </p>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Meta title
                  </label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => set("seoTitle", e.target.value)}
                    placeholder={title || "Title for search engines"}
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                  <p className="text-petroleum-400 text-xs">
                    {seoTitle.length}/60 characters
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Meta description
                  </label>
                  <textarea
                    value={seoDescription}
                    onChange={(e) => set("seoDescription", e.target.value)}
                    placeholder="Brief description for search engines…"
                    rows={3}
                    disabled={saving}
                    className={`${INPUT_CLASS} resize-none`}
                  />
                  <p className="text-petroleum-400 text-xs">
                    {seoDescription.length}/160 characters
                  </p>
                </div>
              </div>
            </div>

            {/* SEO ES */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
                SEO (ES)
              </h2>
              <p className="text-petroleum-400 mb-4 text-xs">
                Versión en español para buscadores.
              </p>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Meta título
                  </label>
                  <input
                    type="text"
                    value={seoTitleEs}
                    onChange={(e) => set("seoTitleEs", e.target.value)}
                    placeholder={titleEs || "Título para buscadores"}
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                  <p className="text-petroleum-400 text-xs">
                    {seoTitleEs.length}/60 caracteres
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Meta descripción
                  </label>
                  <textarea
                    value={seoDescriptionEs}
                    onChange={(e) => set("seoDescriptionEs", e.target.value)}
                    placeholder="Breve descripción para buscadores…"
                    rows={3}
                    disabled={saving}
                    className={`${INPUT_CLASS} resize-none`}
                  />
                  <p className="text-petroleum-400 text-xs">
                    {seoDescriptionEs.length}/160 caracteres
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
