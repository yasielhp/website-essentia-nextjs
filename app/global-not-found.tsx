import type { Metadata } from "next";
import "./globals.css";
import { NotFoundDocument } from "@components/not-found-document";

/**
 * The 404 for any URL that matches no route.
 *
 * There is no `app/layout.tsx` — the public site, the dashboard and the
 * account area each own their root layout inside a route group. A URL that
 * matches none of them lands outside every group, so `not-found.tsx` was
 * rendered inside a generated root layout: bare `<html>`, no stylesheet and no
 * fonts, which is why the page came out unstyled.
 *
 * `global-not-found` bypasses the root layout by design and brings its own
 * document, so the styles are imported here and the fonts go on the `<html>`
 * in `NotFoundDocument`.
 */

export const metadata: Metadata = {
  title: "404 — Page not found | Essentia",
  description: "The page you're looking for doesn't exist.",
};

export default function GlobalNotFound() {
  return <NotFoundDocument />;
}
