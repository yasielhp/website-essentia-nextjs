"use client";

import { useEffect, useReducer, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
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
  coverImageUrl: string;
  categoryId: string;
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
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
  coverImageUrl: "",
  categoryId: "",
  status: "draft",
  seoTitle: "",
  seoDescription: "",
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
    coverImageUrl,
    categoryId,
    status,
    seoTitle,
    seoDescription,
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      dispatch({ type: "ERROR", msg: "El título y el slug son obligatorios." });
      return;
    }
    dispatch({ type: "SAVING" });

    const { error: err } = await insforge.database.from("blog_posts").insert([
      {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        content: content.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        category_id: categoryId || null,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_og_image_url: coverImageUrl.trim() || null,
      },
    ]);

    if (err) {
      dispatch({
        type: "ERROR",
        msg: (err as { message?: string }).message ?? "Error al guardar.",
      });
      return;
    }
    push("/dashboard/blog");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            Nuevo post
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/blog">
              Cancelar
            </Button>
            <Button type="submit" variant="solid" size="md" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
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
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Contenido
              </h2>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Título <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Mi primer artículo"
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
                      onChange={(e) =>
                        dispatch({
                          type: "SET",
                          field: "slug",
                          value: e.target.value,
                        })
                      }
                      placeholder="mi-primer-articulo"
                      disabled={saving}
                      className={`${INPUT_CLASS} rounded-l-none border-l-0`}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Imagen destacada
                  </label>
                  <input
                    type="url"
                    value={coverImageUrl}
                    onChange={(e) =>
                      dispatch({
                        type: "SET",
                        field: "coverImageUrl",
                        value: e.target.value,
                      })
                    }
                    placeholder="https://…"
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                  {coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverImageUrl}
                      alt="Vista previa"
                      className="border-sand-200 mt-2 h-40 w-full rounded-xl border object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Extracto
                  </label>
                  <textarea
                    value={excerpt}
                    onChange={(e) =>
                      dispatch({
                        type: "SET",
                        field: "excerpt",
                        value: e.target.value,
                      })
                    }
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
                      value={content}
                      onChange={(val) =>
                        dispatch({
                          type: "SET",
                          field: "content",
                          value: val ?? "",
                        })
                      }
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
                Estado
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
                    {s === "draft" ? "Borrador" : "Publicado"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Categoría
              </h2>
              <select
                value={categoryId}
                onChange={(e) =>
                  dispatch({
                    type: "SET",
                    field: "categoryId",
                    value: e.target.value,
                  })
                }
                disabled={saving}
                className={SELECT_CLASS}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <a
                href="/dashboard/blog/categories"
                target="_blank"
                className="text-petroleum-400 hover:text-petroleum-600 mt-3 block text-xs underline"
              >
                Gestionar categorías →
              </a>
            </div>

            {/* SEO */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
                SEO
              </h2>
              <p className="text-petroleum-400 mb-4 text-xs">
                Cómo aparece en buscadores y redes sociales.
              </p>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Meta título
                  </label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) =>
                      dispatch({
                        type: "SET",
                        field: "seoTitle",
                        value: e.target.value,
                      })
                    }
                    placeholder={title || "Título para buscadores"}
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                  <p className="text-petroleum-400 text-xs">
                    {seoTitle.length}/60 caracteres
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Meta descripción
                  </label>
                  <textarea
                    value={seoDescription}
                    onChange={(e) =>
                      dispatch({
                        type: "SET",
                        field: "seoDescription",
                        value: e.target.value,
                      })
                    }
                    placeholder="Descripción breve para buscadores…"
                    rows={3}
                    disabled={saving}
                    className={`${INPUT_CLASS} resize-none`}
                  />
                  <p className="text-petroleum-400 text-xs">
                    {seoDescription.length}/160 caracteres
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
