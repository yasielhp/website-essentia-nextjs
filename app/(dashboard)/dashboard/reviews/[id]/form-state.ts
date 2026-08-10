/**
 * A review being edited, and every way the form changes it.
 *
 * Its own file so both columns can dispatch without importing the page.
 */
export type Review = {
  id: string;
  quote: string;
  name: string;
  age: string;
  initials: string;
  display_order: number;
  status: "draft" | "published";
};

export function computeInitials(name: string): string {
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

export type FormState = {
  submitting: boolean;
  deleting: boolean;
  error: string | null;
  quote: string;
  name: string;
  age: string;
  initials: string;
  status: "draft" | "published";
  displayOrder: number;
};

export type FormAction =
  | { type: "INIT"; review: Review }
  | {
      type: "SET_FIELD";
      field: "quote" | "name" | "age" | "initials";
      value: string;
    }
  | { type: "SET_STATUS"; value: "draft" | "published" }
  | { type: "SET_ORDER"; value: number }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR"; message: string }
  | { type: "DELETE_START" };

export const initialState: FormState = {
  submitting: false,
  deleting: false,
  error: null,
  quote: "",
  name: "",
  age: "",
  initials: "",
  status: "draft",
  displayOrder: 0,
};

export function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        quote: action.review.quote,
        name: action.review.name,
        age: action.review.age,
        initials: action.review.initials,
        status: action.review.status,
        displayOrder: action.review.display_order,
      };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_STATUS":
      return { ...state, status: action.value };
    case "SET_ORDER":
      return { ...state, displayOrder: action.value };
    case "SAVE_START":
      return { ...state, submitting: true, error: null };
    case "SAVE_SUCCESS":
      return { ...state, submitting: false };
    case "SAVE_ERROR":
      return { ...state, submitting: false, error: action.message };
    case "DELETE_START":
      return { ...state, deleting: true };
    default:
      return state;
  }
}

// ─── Delete dialog ────────────────────────────────────────────
