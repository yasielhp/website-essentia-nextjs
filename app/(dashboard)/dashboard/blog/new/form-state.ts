/**
 * A post being written, and every way the form changes it.
 *
 * Apart from the page because the editor and the sidebar both dispatch into it
 * and have no other reason to import the screen around them.
 */
export type Category = { id: string; name: string };

export type FormState = {
  saving: boolean;
  error: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  titleEs: string;
  excerptEs: string;
  contentEs: string;
  coverImageUrl: string;
  categoryId: string;
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  seoTitleEs: string;
  seoDescriptionEs: string;
};

export type Action =
  | {
      type: "SET";
      field: keyof Omit<FormState, "saving" | "error">;
      value: string;
    }
  | { type: "SET_STATUS"; value: "draft" | "published" }
  | { type: "SAVING" }
  | { type: "ERROR"; msg: string }
  | { type: "DONE" };

export const init: FormState = {
  saving: false,
  error: null,
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  titleEs: "",
  excerptEs: "",
  contentEs: "",
  coverImageUrl: "",
  categoryId: "",
  status: "draft",
  seoTitle: "",
  seoDescription: "",
  seoTitleEs: "",
  seoDescriptionEs: "",
};

export function reducer(s: FormState, a: Action): FormState {
  switch (a.type) {
    case "SET":
      return { ...s, [a.field]: a.value };
    case "SET_STATUS":
      return { ...s, status: a.value };
    case "SAVING":
      return { ...s, saving: true, error: null };
    case "ERROR":
      return { ...s, saving: false, error: a.msg };
    case "DONE":
      return { ...s, saving: false };
    default:
      return s;
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
