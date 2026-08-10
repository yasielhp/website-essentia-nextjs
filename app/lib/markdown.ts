import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

/**
 * Markdown to HTML, safe to hand to `dangerouslySetInnerHTML`.
 *
 * SERVER ONLY — `sanitize-html` runs on Node.
 *
 * `marked` stopped sanitising in v5 and passes raw HTML in the source straight
 * through, so a post body reached the page verbatim. Blog posts are written by
 * staff in the dashboard, which makes this a second line of defence rather than
 * the first, but it is the line that holds if an account is taken over or if a
 * post is ever imported from somewhere else: without it, one `<script>` in a
 * draft runs on every visitor's browser, on our own origin, with our own
 * cookies.
 *
 * The allowlist is what an article actually needs. Notably absent: `script`,
 * `style`, `iframe`, `object`, `form` and every `on*` attribute, all of which
 * `sanitize-html` drops by default anyway — they are named here so that adding
 * one back is a deliberate act.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "del",
  "sup",
  "sub",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "figure",
  "figcaption",
  "code",
  "pre",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return "";

  const html = marked.parse(source, { async: false });

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      // The dashboard editor emits these for syntax highlighting.
      code: ["class"],
      pre: ["class"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    // No `javascript:` or `data:` URLs, whatever the tag.
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      // An external link that opens in a new tab without `noopener` hands the
      // opener a handle on our window.
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
      }),
    },
  });
}
