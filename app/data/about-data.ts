/**
 * Shapes for the translated content of the about page.
 *
 * The principles and the team used to be hardcoded arrays here, in English,
 * which is why the Spanish page showed English copy. Both now live in
 * `messages/<locale>/about.json` and are read with `t.raw()`.
 */

export type Principle = {
  number: string;
  title: string;
  description: string;
};

export type TeamMember = {
  name: string;
  role: string;
  area: string;
};
