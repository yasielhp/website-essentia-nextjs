"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS, TEXTAREA_CLASS } from "@/constants/form-styles";

function computeInitials(name: string): string {
  const parts = name
    .replace(/^(Dr\.|Dra\.|Prof\.)\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return (parts[0]![0] ?? "").toUpperCase();
  return (
    (parts[0]![0] ?? "").toUpperCase() +
    (parts[parts.length - 1]![0] ?? "").toUpperCase()
  );
}

// ─── State ────────────────────────────────────────────────────

type FormState = {
  submitting: boolean;
  error: string | null;
  quote: string;
  name: string;
  age: string;
  initials: string;
};

type FormAction =
  | {
      type: "SET_FIELD";
      field: keyof Omit<FormState, "submitting" | "error">;
      value: string;
    }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "CLEAR_ERROR" };

const initialState: FormState = {
  submitting: false,
  error: null,
  quote: "",
  name: "",
  age: "",
  initials: "",
};

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SUBMIT_START":
      return { ...state, submitting: true, error: null };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, error: action.message };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function NewReviewPage() {
  const t = useTranslations("dashboard.reviews.form");
  const tCommon = useTranslations("dashboard.common");
  const { push } = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { submitting, error, quote, name, age, initials } = state;

  function setField(
    field: keyof Omit<FormState, "submitting" | "error">,
    value: string,
  ) {
    dispatch({ type: "SET_FIELD", field, value });
  }

  function handleNameChange(value: string) {
    dispatch({ type: "SET_FIELD", field: "name", value });
    dispatch({
      type: "SET_FIELD",
      field: "initials",
      value: computeInitials(value),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "CLEAR_ERROR" });

    if (!quote.trim() || !name.trim()) {
      dispatch({
        type: "SUBMIT_ERROR",
        message: t("errors.required"),
      });
      return;
    }

    dispatch({ type: "SUBMIT_START" });

    const { data: maxRow } = await insforge.database
      .from("reviews")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1);

    const maxOrder =
      ((maxRow as { display_order: number }[] | null)?.[0]?.display_order ??
        0) + 1;

    const { error: dbError } = await insforge.database.from("reviews").insert({
      quote: quote.trim(),
      name: name.trim(),
      age: age.trim(),
      initials: initials.trim() || computeInitials(name.trim()),
      display_order: maxOrder,
      status: "draft",
    });

    if (dbError) {
      dispatch({
        type: "SUBMIT_ERROR",
        message:
          (dbError as { message?: string })?.message ??
          t("errors.createFailed"),
      });
      return;
    }

    push("/dashboard/reviews");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {t("title")}
          </h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/reviews">
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
            >
              {submitting ? t("creating") : t("saveDraft")}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* Quote */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              {t("sections.review")}
            </h2>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="quote"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("fields.quote")} <span className="text-red-400">*</span>
              </label>
              <textarea
                id="quote"
                value={quote}
                onChange={(e) => setField("quote", e.target.value)}
                placeholder={t("fields.quotePlaceholder")}
                rows={4}
                disabled={submitting}
                className={TEXTAREA_CLASS}
              />
            </div>
          </div>

          {/* Author */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              {t("sections.author")}
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="name"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("fields.name")} <span className="text-red-400">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={t("fields.namePlaceholder")}
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="age"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.age")}
                  </label>
                  <input
                    id="age"
                    type="number"
                    min={1}
                    max={120}
                    value={age}
                    onChange={(e) => setField("age", e.target.value)}
                    placeholder={t("fields.agePlaceholder")}
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="initials"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.initials")}
                  </label>
                  <input
                    id="initials"
                    type="text"
                    value={initials}
                    onChange={(e) =>
                      setField("initials", e.target.value.toUpperCase())
                    }
                    placeholder={t("fields.initialsPlaceholder")}
                    maxLength={3}
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
