/** A blog category, as both halves of the screen read it. */
export type Category = {
  id: string;
  name: string;
  slug: string;
  name_es: string | null;
  slug_es: string | null;
  created_at: string;
};
