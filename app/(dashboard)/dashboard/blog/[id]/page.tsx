"use client";

import { useEffect, useReducer, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS, SELECT_CLASS } from "@/constants/form-styles";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

type Category = { id: string; name: string };

type FormState = {
  loading: boolean;
  saving: boolean;
  deleting: boolean;
  confirmDelete: boolean;
  notFound: boolean;
  error: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  categoryId: string;
  status: "draft" | "published";
  publishedAt: string | null;
  seoTitle: string;
  seoDescription: string;
};

type Action =
  | {
      type: "LOADED";
      post: Omit<
        FormState,
        | "loading"
        | "saving"
        | "deleting"
        | "confirmDelete"
        | "notFound"
        | "error"
      >;
    }
  | { type: "NOT_FOUND" }
  | { type: "SET"; field: string; value: string }
  | { type: "SET_STATUS"; value: "draft" | "published" }
  | { type: "SAVING" }
  | { type: "DELETING" }
  | { type: "CONFIRM_DELETE"; open: boolean }
  | { type: "ERROR"; msg: string }
  | { type: "DONE" };

const init: FormState = {
  loading: true,
  saving: false,
  deleting: false,
  confirmDelete: false,
  notFound: false,
  error: null,
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  categoryId: "",
  status: "draft",
  publishedAt: null,
  seoTitle: "",
  seoDescription: "",
};

function reducer(s: FormState, a: Action): FormState {
  switch (a.type) {
    case "LOADED":
      return { ...s, loading: false, ...a.post };
    case "NOT_FOUND":
      return { ...s, loading: false, notFound: true };
    case "SET":
      return { ...s, [a.field]: a.value };
    case "SET_STATUS":
      return { ...s, status: a.value };
    case "SAVING":
      return { ...s, saving: true, error: null };
    case "DELETING":
      return { ...s, deleting: true };
    case "CONFIRM_DELETE":
      return { ...s, confirmDelete: a.open };
    case "ERROR":
      return { ...s, saving: false, deleting: false, error: a.msg };
    case "DONE":
      return { ...s, saving: false, deleting: false };
    default:
      return s;
  }
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const { push } = useRouter();
  const [state, dispatch] = useReducer(reducer, init);
  const [categories, setCategories] = useState<Category[]>([]);
  const { loading, saving, deleting, confirmDelete, notFound, error } = state;
  const {
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
    Promise.all([
      insforge.database
        .from("blog_posts")
        .select(
          "title, slug, excerpt, content, cover_image_url, category_id, status, published_at, seo_title, seo_description",
        )
        .eq("id", id)
        .single(),
      insforge.database
        .from("blog_categories")
        .select("id, name")
        .order("name"),
    ]).then(([{ data: post }, { data: cats }]) => {
      setCategories((cats as Category[] | null) ?? []);
      if (!post) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }
      const p = post as {
        title: string;
        slug: string;
        excerpt: string | null;
        content: string | null;
        cover_image_url: string | null;
        category_id: string | null;
        status: "draft" | "published";
        published_at: string | null;
        seo_title: string | null;
        seo_description: string | null;
      };
      dispatch({
        type: "LOADED",
        post: {
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt ?? "",
          content: p.content ?? "",
          coverImageUrl: p.cover_image_url ?? "",
          categoryId: p.category_id ?? "",
          status: p.status,
          publishedAt: p.published_at,
          seoTitle: p.seo_title ?? "",
          seoDescription: p.seo_description ?? "",
        },
      });
    });
  }, [id]);

  function handleTitleChange(val: string) {
    dispatch({ type: "SET", field: "title", value: val });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      dispatch({ type: "ERROR", msg: "El título y el slug son obligatorios." });
      return;
    }
    dispatch({ type: "SAVING" });

    const wasPublished = state.publishedAt !== null;
    const isPublishing = status === "published" && !wasPublished;

    const { error: err } = await insforge.database
      .from("blog_posts")
      .update({
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        content: content.trim() || null,
        cover_image_url: coverImageUrl.trim() || null,
        category_id: categoryId || null,
        status,
        published_at: isPublishing
          ? new Date().toISOString()
          : status === "draft"
            ? null
            : state.publishedAt,
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_og_image_url: coverImageUrl.trim() || null,
      })
      .eq("id", id);

    if (err) {
      dispatch({
        type: "ERROR",
        msg: (err as { message?: string }).message ?? "Error al guardar.",
      });
      return;
    }
    push("/dashboard/blog");
  }

  async function handleDelete() {
    dispatch({ type: "DELETING" });
    await insforge.database.from("blog_posts").delete().eq("id", id);
    push("/dashboard/blog");
  }

  if (notFound)
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24 text-sm">
        Post no encontrado.
      </div>
    );

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            Editar post
          </h1>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() => dispatch({ type: "CONFIRM_DELETE", open: true })}
              disabled={loading}
              className="gap-1.5"
            >
              <IconTrash /> Eliminar
            </Button>
            <Button variant="outline" size="md" href="/dashboard/blog">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
            >
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
          {/* Main — 2/3 */}
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
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Slug <span className="text-red-400">*</span>
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
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
                        disabled={saving}
                        className={`${INPUT_CLASS} rounded-l-none border-l-0`}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Imagen destacada
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <>
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
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Extracto
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-16 animate-pulse rounded-xl" />
                  ) : (
                    <textarea
                      value={excerpt}
                      onChange={(e) =>
                        dispatch({
                          type: "SET",
                          field: "excerpt",
                          value: e.target.value,
                        })
                      }
                      rows={2}
                      disabled={saving}
                      className={`${INPUT_CLASS} resize-y`}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 mb-1 text-xs font-medium">
                    Contenido
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-64 animate-pulse rounded-xl" />
                  ) : (
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
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Estado
              </h2>
              {loading ? (
                <div className="bg-sand-100 h-12 animate-pulse rounded-xl" />
              ) : (
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
              )}
            </div>

            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Categoría
              </h2>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <>
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
                </>
              )}
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
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <>
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
                        placeholder={title}
                        disabled={saving}
                        className={INPUT_CLASS}
                      />
                      <p className="text-petroleum-400 text-xs">
                        {seoTitle.length}/60 caracteres
                      </p>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Meta descripción
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
                  ) : (
                    <>
                      <textarea
                        value={seoDescription}
                        onChange={(e) =>
                          dispatch({
                            type: "SET",
                            field: "seoDescription",
                            value: e.target.value,
                          })
                        }
                        rows={3}
                        disabled={saving}
                        className={`${INPUT_CLASS} resize-none`}
                      />
                      <p className="text-petroleum-400 text-xs">
                        {seoDescription.length}/160 caracteres
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-petroleum-700 text-xl">
                ¿Eliminar post?
              </h3>
              <p className="text-petroleum-400 text-sm">
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="danger"
                size="md"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="w-full"
              >
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() =>
                  dispatch({ type: "CONFIRM_DELETE", open: false })
                }
                disabled={deleting}
                className="w-full"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
