"use client";

import { useEffect, useReducer, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { revalidateBlog } from "@/actions/revalidate-blog";
import { getAccessToken } from "@/lib/client-session";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { IconTrash } from "@/components/ui/icons";
import { PostEditor } from "./post-editor";
import { PostSidebar } from "./post-sidebar";
import { init, reducer, type Category } from "./form-state";

export default function EditPostPage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.blog.detail");
  const tCommon = useTranslations("dashboard.common");
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
        msg: (err as { message?: string }).message ?? t("errors.saveFailed"),
      });
      return;
    }
    await revalidateBlog(
      getAccessToken(),
      slug.trim(),
      slugEs.trim() || undefined,
    );
    notifySuccess(tToasts("postSaved"));
    push("/dashboard/blog");
  }

  async function handleDelete() {
    dispatch({ type: "DELETING" });
    await insforge.database.from("blog_posts").delete().eq("id", id);
    await revalidateBlog(
      getAccessToken(),
      slug.trim(),
      slugEs.trim() || undefined,
    );
    notifySuccess(tToasts("postDeleted"));
    push("/dashboard/blog");
  }

  if (notFound)
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24 text-sm">
        {t("notFound")}
      </div>
    );

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {t("title")}
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
              <IconTrash /> {t("delete")}
            </Button>
            <Button variant="outline" size="md" href="/dashboard/blog">
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
            >
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <PostEditor
            state={state}
            dispatch={dispatch}
            lang={lang}
            setLang={setLang}
          />

          <PostSidebar
            state={state}
            dispatch={dispatch}
            categories={categories}
            lang={lang}
            setLang={setLang}
          />
        </div>
      </form>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-petroleum-700 text-xl">
                {t("deleteDialog.title")}
              </h3>
              <p className="text-petroleum-400 text-sm">
                {t("deleteDialog.body")}
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
                {deleting
                  ? t("deleteDialog.deleting")
                  : t("deleteDialog.confirm")}
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
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
