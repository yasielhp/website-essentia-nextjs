import type { ContentBlock, EmailDoc } from "@/types/campaign";

/**
 * The body as a Tiptap document — what the Maily editor edits and what its
 * renderer turns into email HTML. This module keeps the document minimal and
 * turns the house templates (still written as simple blocks, which read well
 * in code) into that shape.
 */

export function emptyDoc(): EmailDoc {
  return { type: "doc", content: [] };
}

/** True when nothing worth sending is in the document. */
export function docIsEmpty(doc: EmailDoc | null | undefined): boolean {
  if (!doc || !Array.isArray(doc.content) || doc.content.length === 0) {
    return true;
  }
  return doc.content.every((node) => {
    if (node.type === "paragraph") {
      return !(node.content ?? []).some(
        (child) =>
          (child.text ?? "").trim() !== "" || child.type === "variable",
      );
    }
    return false;
  });
}

const BOLD = /\*\*(.+?)\*\*/g;
const LINK = /\[([^\][]+)\]\((https:\/\/[^\s)<]+)\)/gi;

/**
 * Inline text with `**bold**` and `[label](https://…)` into text nodes with
 * marks. Anything else stays as typed, `{{first_name}}` included: the render
 * step fills those in.
 */
export function inlineToNodes(text: string): EmailDoc[] {
  const nodes: EmailDoc[] = [];
  // Split on links first, then bold inside each plain run.
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(...boldRuns(text.slice(last, index)));
    nodes.push({
      type: "text",
      text: match[1]!,
      marks: [{ type: "link", attrs: { href: match[2]!, target: "_blank" } }],
    });
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(...boldRuns(text.slice(last)));
  return nodes;
}

function boldRuns(text: string): EmailDoc[] {
  const nodes: EmailDoc[] = [];
  let last = 0;
  for (const match of text.matchAll(BOLD)) {
    const index = match.index ?? 0;
    if (index > last)
      nodes.push({ type: "text", text: text.slice(last, index) });
    nodes.push({ type: "text", text: match[1]!, marks: [{ type: "bold" }] });
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes.filter((node) => node.text !== "");
}

/** A block of paragraph text: blank lines split paragraphs, newlines break. */
function paragraphNodes(text: string): EmailDoc[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      const content: EmailDoc[] = [];
      lines.forEach((line, i) => {
        if (i > 0) content.push({ type: "hardBreak" });
        content.push(...inlineToNodes(line));
      });
      return { type: "paragraph", content };
    });
}

/** The house templates' blocks as a document the editor can open. */
export function blocksToDoc(blocks: ContentBlock[]): EmailDoc {
  const content: EmailDoc[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
        content.push(...paragraphNodes(block.text));
        break;
      case "heading":
        content.push({
          type: "heading",
          attrs: { level: 2 },
          content: inlineToNodes(block.text),
        });
        break;
      case "image":
        // An image without a file is a placeholder the admin still has to
        // fill; the editor cannot show an empty picture, so it is dropped.
        if (block.url) {
          content.push({
            type: "image",
            attrs: {
              src: block.url,
              alt: block.alt,
              // A number: Maily sizes the image in pixels and a percentage
              // comes out as "NaNpx". The card is 560 wide with 32 of padding.
              width: 496,
              alignment: "center",
            },
          });
        }
        break;
      case "button":
        content.push({
          type: "button",
          attrs: {
            text: block.text,
            url: block.url,
            alignment: "center",
            variant: "filled",
            borderRadius: "round",
            buttonColor: "#103838",
            textColor: "#f0ede6",
          },
        });
        break;
      case "divider":
        content.push({ type: "horizontalRule" });
        break;
    }
  }
  return { type: "doc", content };
}
