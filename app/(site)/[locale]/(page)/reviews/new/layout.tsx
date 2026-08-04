import type { Metadata } from "next";

/**
 * The page itself is a Client Component and cannot export metadata, so the
 * directive lives here.
 *
 * A review submission form has nothing to rank for and duplicates the reviews
 * page in the index; `follow` keeps the link back to the reviews listing
 * meaningful.
 */
export const metadata: Metadata = {
  // Without this the page falls back to the site-wide default title, which
  // describes the whole club rather than the form in front of the reader.
  title: { absolute: "Share your experience | Essentia" },
  robots: { index: false, follow: true },
};

export default function NewReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
