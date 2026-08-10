"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { INPUT_CLASS } from "@/constants/form-styles";
import { slugify, type Action, type FormState } from "./form-state";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

/**
 * Title, slug, excerpt and body — English above, Spanish below.
 *
 * Both languages on screen at once here, unlike the edit screen's toggle: a new
 * post is written in both at a sitting, and hiding one of them is how a post
 * ships with an empty Spanish page.
 */
export function PostEditor({
  state,
  dispatch,
}: {
  state: FormState;
  dispatch: Dispatch<Action>;
}) {
  const t = useTranslations("dashboard.blog.form");
  const { saving, seoTitle } = state;
  const { title, slug, excerpt, content, titleEs, excerptEs, contentEs } =
    state;

  function set(
    field: keyof Omit<FormState, "saving" | "error">,
    value: string,
  ) {
    dispatch({ type: "SET", field, value });
  }

  function handleTitleChange(val: string) {
    dispatch({ type: "SET", field: "title", value: val });
    dispatch({ type: "SET", field: "slug", value: slugify(val) });
    if (!seoTitle) dispatch({ type: "SET", field: "seoTitle", value: val });
  }

  return (
    <div className="space-y-6 lg:col-span-2">
      {/* English content */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("sections.contentEn")}
        </h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="post-title"
              className="text-petroleum-500 text-xs font-medium"
            >
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="My first article"
              disabled={saving}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="post-slug"
              className="text-petroleum-500 text-xs font-medium"
            >
              Slug <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center">
              <span className="text-petroleum-400 border-sand-200 bg-sand-50 rounded-l-xl border border-r-0 px-3 py-2.5 text-xs">
                /blog/
              </span>
              <input
                id="post-slug"
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
            <label
              htmlFor="post-excerpt"
              className="text-petroleum-500 text-xs font-medium"
            >
              Excerpt
            </label>
            <textarea
              id="post-excerpt"
              value={excerpt}
              onChange={(e) => set("excerpt", e.target.value)}
              placeholder="Brief description of the article…"
              rows={2}
              disabled={saving}
              className={`${INPUT_CLASS} resize-y`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="post-content"
              className="text-petroleum-500 mb-1 text-xs font-medium"
            >
              Content
            </label>
            <div data-color-mode="light">
              <MDEditor
                textareaProps={{ id: "post-content" }}
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
          {t("sections.contentEs")}
        </h2>
        <p className="text-petroleum-400 mb-4 text-xs">
          {t("sections.contentEsHint")}
        </p>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="post-titulo"
              className="text-petroleum-500 text-xs font-medium"
            >
              Título
            </label>
            <input
              id="post-titulo"
              type="text"
              value={titleEs}
              onChange={(e) => set("titleEs", e.target.value)}
              placeholder="Mi primer artículo"
              disabled={saving}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="post-extracto"
              className="text-petroleum-500 text-xs font-medium"
            >
              Extracto
            </label>
            <textarea
              id="post-extracto"
              value={excerptEs}
              onChange={(e) => set("excerptEs", e.target.value)}
              placeholder="Breve descripción del artículo…"
              rows={2}
              disabled={saving}
              className={`${INPUT_CLASS} resize-y`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="post-content-es"
              className="text-petroleum-500 mb-1 text-xs font-medium"
            >
              Contenido
            </label>
            <div data-color-mode="light">
              <MDEditor
                textareaProps={{ id: "post-content-es" }}
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
  );
}
