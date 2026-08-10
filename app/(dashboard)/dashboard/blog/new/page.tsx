"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { revalidateBlog } from "@/actions/revalidate-blog";
import { getAccessToken } from "@/lib/client-session";
import { Button } from "@/components/ui/button";
import { PostEditor } from "./post-editor";
import { PostSidebar } from "./post-sidebar";
import { init, reducer, type Category } from "./form-state";

export default function NewPostPage() {
  const t = useTranslations("dashboard.blog.form");
  const tCommon = useTranslations("dashboard.common");
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
        msg: (err as { message?: string }).message ?? t("errors.saveFailed"),
      });
      return;
    }
    await revalidateBlog(getAccessToken(), slug.trim());
    push("/dashboard/blog");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {t("title")}
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/blog">
              {tCommon("cancel")}
            </Button>
            <Button type="submit" variant="solid" size="md" disabled={saving}>
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
          <PostEditor state={state} dispatch={dispatch} />

          {/* Sidebar — 1/3 */}
          <PostSidebar
            state={state}
            dispatch={dispatch}
            categories={categories}
          />
        </div>
      </form>
    </div>
  );
}
