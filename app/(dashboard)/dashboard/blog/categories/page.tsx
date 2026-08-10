"use client";

import { useEffect, useReducer, useState } from "react";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
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

/**
 * The form half of this screen, as one value.
 *
 * Editing a category and cancelling both rewrite the same six things at once,
 * and as six setters that was six chances to forget one — the error message
 * outliving the row it belonged to, a slug left over from the last edit. One
 * action per transition says what happened instead of listing what changed.
 */
type FormState = {
  editing: Category | null;
  name: string;
  slug: string;
  nameEs: string;
  slugEs: string;
  error: string | null;
};

type FormAction =
  | { type: "START_EDIT"; category: Category }
  | { type: "CANCEL_EDIT" }
  | { type: "SET_NAME"; value: string }
  | { type: "SET_SLUG"; value: string }
  | { type: "SET_NAME_ES"; value: string }
  | { type: "SET_SLUG_ES"; value: string }
  | { type: "SET_ERROR"; message: string | null };

const EMPTY_FORM: FormState = {
  editing: null,
  name: "",
  slug: "",
  nameEs: "",
  slugEs: "",
  error: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "START_EDIT":
      return {
        editing: action.category,
        name: action.category.name,
        slug: action.category.slug,
        nameEs: action.category.name_es ?? "",
        slugEs: action.category.slug_es ?? "",
        error: null,
      };
    case "CANCEL_EDIT":
      return EMPTY_FORM;
    case "SET_NAME":
      // A new category takes its slug from its name; an existing one keeps the
      // slug it was published under.
      return {
        ...state,
        name: action.value,
        slug: state.editing ? state.slug : slugify(action.value),
      };
    case "SET_NAME_ES":
      return {
        ...state,
        nameEs: action.value,
        slugEs: state.editing ? state.slugEs : slugify(action.value),
      };
    case "SET_SLUG":
      return { ...state, slug: action.value };
    case "SET_SLUG_ES":
      return { ...state, slugEs: action.value };
    case "SET_ERROR":
      return { ...state, error: action.message };
  }
}

export default function BlogCategoriesPage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.blog.categories_page");
  const tCommon = useTranslations("dashboard.common");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<"en" | "es">("en");
  const [form, dispatch] = useReducer(formReducer, EMPTY_FORM);
  const { editing, name, slug, nameEs, slugEs, error } = form;

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
    dispatch({ type: "START_EDIT", category: cat });
  }

  function cancelEdit() {
    dispatch({ type: "CANCEL_EDIT" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", message: null });
    if (!name.trim() || !slug.trim() || !nameEs.trim() || !slugEs.trim()) {
      dispatch({
        type: "SET_ERROR",
        message: "Name and slug are required in both languages.",
      });
      return;
    }
    setSaving(true);

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      name_es: nameEs.trim() || null,
      slug_es: slugEs.trim() || null,
    };

    // One `finally` for both branches: the reset used to sit on each success
    // path, so a rejected save left the form disabled for good.
    try {
      if (editing) {
        const { error: err } = await insforge.database
          .from("blog_categories")
          .update(payload)
          .eq("id", editing.id);
        if (err) {
          dispatch({
            type: "SET_ERROR",
            message:
              (err as { message?: string }).message ?? t("errors.saveFailed"),
          });
          return;
        }
        cancelEdit();
      } else {
        const { error: err } = await insforge.database
          .from("blog_categories")
          .insert([payload]);
        if (err) {
          dispatch({
            type: "SET_ERROR",
            message:
              (err as { message?: string }).message ?? t("errors.createFailed"),
          });
          return;
        }
        dispatch({ type: "CANCEL_EDIT" });
      }
    } finally {
      setSaving(false);
    }

    notifySuccess(tToasts("categorySaved"));
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
        <h1 className="font-display text-petroleum-700 text-3xl">
          {t("title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Add / Edit form */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-petroleum-500 text-sm font-semibold">
              {editing ? t("editCategory") : t("newCategory")}
            </h2>
            <div className="bg-sand-100 flex gap-1 rounded-lg p-1">
              {(["en", "es"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={TAB_BTN(lang === l)}
                >
                  {l === "en" ? tCommon("english") : tCommon("spanish")}
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
                  <label
                    htmlFor="category-name"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.name")} <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="category-name"
                    type="text"
                    value={name}
                    onChange={(e) =>
                      dispatch({ type: "SET_NAME", value: e.target.value })
                    }
                    placeholder={t("fields.namePlaceholder")}
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="category-slug"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.slug")} <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="category-slug"
                    type="text"
                    value={slug}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_SLUG",
                        value: sanitizeSlug(e.target.value),
                      })
                    }
                    placeholder={t("fields.slugPlaceholder")}
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="category-name-es"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.name")} <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="category-name-es"
                    type="text"
                    value={nameEs}
                    onChange={(e) =>
                      dispatch({ type: "SET_NAME_ES", value: e.target.value })
                    }
                    placeholder={t("fields.namePlaceholderEs")}
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="category-slug-es"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.slug")} <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="category-slug-es"
                    type="text"
                    value={slugEs}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_SLUG_ES",
                        value: sanitizeSlug(e.target.value),
                      })
                    }
                    placeholder={t("fields.slugPlaceholderEs")}
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button type="submit" variant="solid" size="md" disabled={saving}>
                {saving
                  ? t("saving")
                  : editing
                    ? t("saveChanges")
                    : t("addCategory")}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  {tCommon("cancel")}
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
                    {t("columns.name")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    {t("columns.slug")}
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
                      {t("empty")}
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
                            {t("edit")}
                          </button>
                          <button
                            onClick={() => void handleDelete(c.id)}
                            aria-label={`${t("delete")} — ${c.name}`}
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
