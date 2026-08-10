/**
 * A post being edited, and every way the form changes it.
 *
 * Apart from the page because the editor and the sidebar both dispatch into it
 * and have no other reason to import the screen around them.
 */
export type Category = { id: string; name: string };

export type FormState = {
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

export type Action =
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

export const init: FormState = {
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

export function reducer(s: FormState, a: Action): FormState {
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
