"use client";

import { type Dispatch } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import type { Action, FormState } from "./form-state";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

/**
 * Title, slug, excerpt and body — in English, then in Spanish.
 *
 * The language toggle belongs to the page rather than here: the SEO card in the
 * sidebar follows the same choice, and two toggles disagreeing about which post
 * you are writing is how a Spanish excerpt ends up on an English page.
 */
export function PostEditor({
  state,
  dispatch,
  lang,
  setLang,
}: {
  state: FormState;
  dispatch: Dispatch<Action>;
  lang: "en" | "es";
  setLang: (lang: "en" | "es") => void;
}) {
  const t = useTranslations("dashboard.blog.detail");
  const tCommon = useTranslations("dashboard.common");
  const {
    loading,
    saving,
    title,
    slug,
    excerpt,
    content,
    titleEs,
    slugEs,
    excerptEs,
    contentEs,
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

  return (
    <div className="space-y-6 lg:col-span-2">
      {/* Content tabs */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-petroleum-500 text-sm font-semibold">
            {t("sections.content")}
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
                {l === "en" ? tCommon("english") : tCommon("spanish")}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {lang === "en" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="post-title"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.title")} <span className="text-red-400">*</span>
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
                  <input
                    id="post-title"
                    type="text"
                    value={title}
                    onChange={(e) => set("title", e.target.value)}
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="post-slug"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.slug")} <span className="text-red-400">*</span>
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
                  <div className="flex items-center">
                    <span className="text-petroleum-400 border-sand-200 bg-sand-50 rounded-l-xl border border-r-0 px-3 py-2.5 text-xs">
                      /blog/
                    </span>
                    <input
                      id="post-slug"
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
                <label
                  htmlFor="post-excerpt"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.excerpt")}
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-16 animate-pulse rounded-xl" />
                ) : (
                  <textarea
                    id="post-excerpt"
                    value={excerpt}
                    onChange={(e) => set("excerpt", e.target.value)}
                    rows={2}
                    disabled={saving}
                    className={`${INPUT_CLASS} resize-y`}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="post-content"
                  className="text-petroleum-500 mb-1 text-xs font-medium"
                >
                  {t("fields.content")}
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-64 animate-pulse rounded-xl" />
                ) : (
                  <div data-color-mode="light">
                    <MDEditor
                      textareaProps={{ id: "post-content" }}
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
                <label
                  htmlFor="post-title-es"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.title")} <span className="text-red-400">*</span>
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
                  <input
                    id="post-title-es"
                    type="text"
                    value={titleEs}
                    onChange={(e) => set("titleEs", e.target.value)}
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="post-slug-es"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.slug")} <span className="text-red-400">*</span>
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
                  <div className="flex items-center">
                    <span className="text-petroleum-400 border-sand-200 bg-sand-50 rounded-l-xl border border-r-0 px-3 py-2.5 text-xs">
                      /blog/
                    </span>
                    <input
                      id="post-slug-es"
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
                <label
                  htmlFor="post-excerpt-es"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.excerpt")}
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-16 animate-pulse rounded-xl" />
                ) : (
                  <textarea
                    id="post-excerpt-es"
                    value={excerptEs}
                    onChange={(e) => set("excerptEs", e.target.value)}
                    rows={2}
                    disabled={saving}
                    className={`${INPUT_CLASS} resize-y`}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="post-content-es"
                  className="text-petroleum-500 mb-1 text-xs font-medium"
                >
                  {t("fields.content")}
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-64 animate-pulse rounded-xl" />
                ) : (
                  <div data-color-mode="light">
                    <MDEditor
                      textareaProps={{ id: "post-content-es" }}
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
  );
}
