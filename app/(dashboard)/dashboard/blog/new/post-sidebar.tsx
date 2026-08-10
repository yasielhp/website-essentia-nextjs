"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { ImageUpload } from "@/components/ui/image-upload";
import { INPUT_CLASS, SELECT_CLASS } from "@/constants/form-styles";
import type { Action, Category, FormState } from "./form-state";

/**
 * Everything about the post that is not the post: whether it is published, its
 * cover, its category, and what a search engine is told about it.
 */
export function PostSidebar({
  state,
  dispatch,
  categories,
}: {
  state: FormState;
  dispatch: Dispatch<Action>;
  categories: Category[];
}) {
  const t = useTranslations("dashboard.blog.form");
  const tStatus = useTranslations("dashboard.blog.status");
  const { saving, title, titleEs } = state;
  const {
    coverImageUrl,
    categoryId,
    status,
    seoTitle,
    seoDescription,
    seoTitleEs,
    seoDescriptionEs,
  } = state;

  function set(
    field: keyof Omit<FormState, "saving" | "error">,
    value: string,
  ) {
    dispatch({ type: "SET", field, value });
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("sections.status")}
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
              {tStatus(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Featured image */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("sections.featuredImage")}
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
          {t("sections.category")}
        </h2>
        <select
          value={categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
          aria-label={t("sections.category")}
          disabled={saving}
          className={SELECT_CLASS}
        >
          <option value="">{t("noCategory")}</option>
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
          {t("sections.seoEn")}
        </h2>
        <p className="text-petroleum-400 mb-4 text-xs">
          {t("sections.seoEnHint")}
        </p>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="post-meta-title"
              className="text-petroleum-500 text-xs font-medium"
            >
              Meta title
            </label>
            <input
              id="post-meta-title"
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
            <label
              htmlFor="post-meta-description"
              className="text-petroleum-500 text-xs font-medium"
            >
              Meta description
            </label>
            <textarea
              id="post-meta-description"
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
          {t("sections.seoEs")}
        </h2>
        <p className="text-petroleum-400 mb-4 text-xs">
          {t("sections.seoEsHint")}
        </p>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="post-meta-titulo"
              className="text-petroleum-500 text-xs font-medium"
            >
              Meta título
            </label>
            <input
              id="post-meta-titulo"
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
            <label
              htmlFor="post-meta-descripcion"
              className="text-petroleum-500 text-xs font-medium"
            >
              Meta descripción
            </label>
            <textarea
              id="post-meta-descripcion"
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
  );
}
