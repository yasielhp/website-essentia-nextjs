"use client";

import { useEffect, useReducer, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { INPUT_CLASS, SELECT_CLASS } from "@/constants/form-styles";
import { IconTrash } from "@/components/ui/icons";

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
  titleEs: string;
  slugEs: string;
  excerptEs: string;
  contentEs: string;
  coverImageUrl: string;
  categoryId: string;
  status: "draft" | "published";
  publishedAt: string | null;
  seoTitle: string;
  seoDescription: string;
  seoTitleEs: string;
  seoDescriptionEs: string;
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
  titleEs: "",
  slugEs: "",
  excerptEs: "",
  contentEs: "",
  coverImageUrl: "",
  categoryId: "",
  status: "draft",
  publishedAt: null,
  seoTitle: "",
  seoDescription: "",
  seoTitleEs: "",
  seoDescriptionEs: "",
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

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const { push } = useRouter();
  const [state, dispatch] = useReducer(reducer, init);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lang, setLang] = useState<"en" | "es">("en");
  const { loading, saving, deleting, confirmDelete, notFound, error } = state;
  const {
    title,
    slug,
    excerpt,
    content,
    titleEs,
    slugEs,
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

  function set(field: string, value: string) {
    dispatch({ type: "SET", field, value });
  }

  function setSlug(value: string) {
    dispatch({
      type: "SET",
      field: "slug",
      value: value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-{2,}/g, "-"),
    });
  }

  function setSlugEs(value: string) {
    dispatch({
      type: "SET",
      field: "slugEs",
      value: value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-{2,}/g, "-"),
    });
  }

  useEffect(() => {
    Promise.all([
      insforge.database
        .from("blog_posts")
        .select(
          "title, slug, slug_es, excerpt, content, title_es, excerpt_es, content_es, cover_image_url, category_id, status, published_at, seo_title, seo_description, seo_title_es, seo_description_es",
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
        title_es: string | null;
        slug_es: string | null;
        excerpt_es: string | null;
        content_es: string | null;
        cover_image_url: string | null;
        category_id: string | null;
        status: "draft" | "published";
        published_at: string | null;
        seo_title: string | null;
        seo_description: string | null;
        seo_title_es: string | null;
        seo_description_es: string | null;
      };
      dispatch({
        type: "LOADED",
        post: {
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt ?? "",
          content: p.content ?? "",
          titleEs: p.title_es ?? "",
          slugEs: p.slug_es ?? "",
          excerptEs: p.excerpt_es ?? "",
          contentEs: p.content_es ?? "",
          coverImageUrl: p.cover_image_url ?? "",
          categoryId: p.category_id ?? "",
          status: p.status,
          publishedAt: p.published_at,
          seoTitle: p.seo_title ?? "",
          seoDescription: p.seo_description ?? "",
          seoTitleEs: p.seo_title_es ?? "",
          seoDescriptionEs: p.seo_description_es ?? "",
        },
      });
    });
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || !titleEs.trim() || !slugEs.trim()) {
      dispatch({
        type: "ERROR",
        msg: "Title and slug are required in both languages.",
      });
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
        title_es: titleEs.trim() || null,
        slug_es: slugEs.trim() || null,
        excerpt_es: excerptEs.trim() || null,
        content_es: contentEs.trim() || null,
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
        seo_title_es: seoTitleEs.trim() || null,
        seo_description_es: seoDescriptionEs.trim() || null,
        seo_og_image_url: coverImageUrl.trim() || null,
      })
      .eq("id", id);

    if (err) {
      dispatch({
        type: "ERROR",
        msg: (err as { message?: string }).message ?? "Failed to save.",
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
        Post not found.
      </div>
    );

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            Edit post
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
              <IconTrash /> Delete
            </Button>
            <Button variant="outline" size="md" href="/dashboard/blog">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
            >
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
          {/* Main — 2/3 */}
          <div className="space-y-6 lg:col-span-2">
            {/* Content tabs */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-petroleum-500 text-sm font-semibold">
                  Content
                </h2>
                <div className="bg-sand-100 flex gap-1 rounded-lg p-1">
                  {(["en", "es"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      className={[
                        "rounded-md px-3 py-1 text-xs font-semibold tracking-wide uppercase transition-colors",
                        lang === l
                          ? "text-petroleum-700 bg-white shadow-sm"
                          : "text-petroleum-400 hover:text-petroleum-600",
                      ].join(" ")}
                    >
                      {l === "en" ? "English" : "Español"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {lang === "en" ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 text-xs font-medium">
                        Title <span className="text-red-400">*</span>
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                      ) : (
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => set("title", e.target.value)}
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
                            onChange={(e) => setSlug(e.target.value)}
                            disabled={saving}
                            className={`${INPUT_CLASS} rounded-l-none border-l-0`}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 text-xs font-medium">
                        Excerpt
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-16 animate-pulse rounded-xl" />
                      ) : (
                        <textarea
                          value={excerpt}
                          onChange={(e) => set("excerpt", e.target.value)}
                          rows={2}
                          disabled={saving}
                          className={`${INPUT_CLASS} resize-y`}
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 mb-1 text-xs font-medium">
                        Content
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-64 animate-pulse rounded-xl" />
                      ) : (
                        <div data-color-mode="light">
                          <MDEditor
                            value={content}
                            onChange={(val) => set("content", val ?? "")}
                            height={480}
                            preview="edit"
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 text-xs font-medium">
                        Title <span className="text-red-400">*</span>
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                      ) : (
                        <input
                          type="text"
                          value={titleEs}
                          onChange={(e) => set("titleEs", e.target.value)}
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
                            value={slugEs}
                            onChange={(e) => setSlugEs(e.target.value)}
                            disabled={saving}
                            className={`${INPUT_CLASS} rounded-l-none border-l-0`}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 text-xs font-medium">
                        Excerpt
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-16 animate-pulse rounded-xl" />
                      ) : (
                        <textarea
                          value={excerptEs}
                          onChange={(e) => set("excerptEs", e.target.value)}
                          rows={2}
                          disabled={saving}
                          className={`${INPUT_CLASS} resize-y`}
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 mb-1 text-xs font-medium">
                        Content
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-64 animate-pulse rounded-xl" />
                      ) : (
                        <div data-color-mode="light">
                          <MDEditor
                            value={contentEs}
                            onChange={(val) => set("contentEs", val ?? "")}
                            height={480}
                            preview="edit"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Status
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
                      {s === "draft" ? "Draft" : "Published"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Featured image */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Featured image
              </h2>
              {loading ? (
                <div className="bg-sand-100 h-32 animate-pulse rounded-xl" />
              ) : (
                <ImageUpload
                  apiEndpoint="/api/blog/upload"
                  folder="covers"
                  value={coverImageUrl || undefined}
                  onChange={(url) => set("coverImageUrl", url)}
                />
              )}
            </div>

            {/* Category */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Category
              </h2>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
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
              )}
            </div>

            {/* SEO tabs */}
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-petroleum-500 text-sm font-semibold">
                  SEO
                </h2>
                <div className="bg-sand-100 flex gap-1 rounded-lg p-1">
                  {(["en", "es"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      className={[
                        "rounded-md px-3 py-1 text-xs font-semibold tracking-wide uppercase transition-colors",
                        lang === l
                          ? "text-petroleum-700 bg-white shadow-sm"
                          : "text-petroleum-400 hover:text-petroleum-600",
                      ].join(" ")}
                    >
                      {l === "en" ? "English" : "Español"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {lang === "en" ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 text-xs font-medium">
                        Meta title
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                      ) : (
                        <>
                          <input
                            type="text"
                            value={seoTitle}
                            onChange={(e) => set("seoTitle", e.target.value)}
                            placeholder={title}
                            disabled={saving}
                            className={INPUT_CLASS}
                          />
                          <p className="text-petroleum-400 text-xs">
                            {seoTitle.length}/60 characters
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 text-xs font-medium">
                        Meta description
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
                      ) : (
                        <>
                          <textarea
                            value={seoDescription}
                            onChange={(e) =>
                              set("seoDescription", e.target.value)
                            }
                            rows={3}
                            disabled={saving}
                            className={`${INPUT_CLASS} resize-none`}
                          />
                          <p className="text-petroleum-400 text-xs">
                            {seoDescription.length}/160 characters
                          </p>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 text-xs font-medium">
                        Meta title
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                      ) : (
                        <>
                          <input
                            type="text"
                            value={seoTitleEs}
                            onChange={(e) => set("seoTitleEs", e.target.value)}
                            placeholder={titleEs}
                            disabled={saving}
                            className={INPUT_CLASS}
                          />
                          <p className="text-petroleum-400 text-xs">
                            {seoTitleEs.length}/60 characters
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-petroleum-500 text-xs font-medium">
                        Meta description
                      </label>
                      {loading ? (
                        <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
                      ) : (
                        <>
                          <textarea
                            value={seoDescriptionEs}
                            onChange={(e) =>
                              set("seoDescriptionEs", e.target.value)
                            }
                            rows={3}
                            disabled={saving}
                            className={`${INPUT_CLASS} resize-none`}
                          />
                          <p className="text-petroleum-400 text-xs">
                            {seoDescriptionEs.length}/160 characters
                          </p>
                        </>
                      )}
                    </div>
                  </>
                )}
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
                Delete post?
              </h3>
              <p className="text-petroleum-400 text-sm">
                This action cannot be undone.
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
                {deleting ? "Deleting…" : "Yes, delete"}
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
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
