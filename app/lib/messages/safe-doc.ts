import { renderVariables } from "@/lib/campaigns/body-html";
import type { EmailDoc } from "@/types/campaign";

/**
 * What an admin may put in the body of a transactional email, and what the
 * renderer does with the rest.
 *
 * Pure and shared: saving a message rejects what `findForbiddenNodes` finds,
 * and sending one runs the document through `sanitizeDoc`, so a document that
 * was saved before a rule existed (or got in some other way) still cannot
 * reach a client's inbox.
 *
 * What it guards against, in the Maily renderer (`@maily-to/render`):
 *  - `htmlCodeBlock` writes its text into the email as raw HTML, variables
 *    included and unescaped. The only node that does. Removed.
 *  - Links (text links, buttons, link cards, linked images) go into `href`.
 *    Only `https:`, `http:` and `mailto:` may leave; anything else, a
 *    `javascript:` or `data:` address above all, becomes `#`.
 *  - A button, a link card or a text link whose address is a VARIABLE
 *    (`{{consent_url}}`, `{{cancel_url}}`, alone or with something after it)
 *    and which does not come out as an address that may leave is not left
 *    pointing at `#`: the button or the card is removed and the link's text
 *    stays without its link. `consent_url` is empty for every client who has
 *    already signed, and a "Sign the consent" button that goes nowhere is
 *    worse than none.
 *  - "Show conditionally" (`showIfKey` on any block): the renderer draws the
 *    block only when a PAYLOAD value of that name is truthy, and these emails
 *    are rendered with variables and no payload, so such a block would never
 *    be sent. Saving refuses it; sending takes the condition off, so a
 *    document that got in anyway goes out whole, as the editor showed it.
 *  - Images (`image`, `inlineImage`, `logo`) go into `src` and may only be
 *    `https:` or `http:`; one that is not is removed.
 *  - Colours go into inline `style`: anything that is not a plain colour value
 *    is dropped.
 */

/**
 * Nodes that write raw HTML into the email: the one in `@maily-to/render`.
 * Kept as a name for what it is; the allow-list below is what enforces it.
 */
export const FORBIDDEN_NODES: ReadonlySet<string> = new Set(["htmlCodeBlock"]);

/**
 * The node types a body may contain: an allow-list, because the renderer
 * dispatches ANY `type` that happens to be a method of its class
 * (`if (type in this) this[type](...)`). `{"type":"render"}` calls
 * `Maily.render()` again and never returns; `markup` and `children` blow the
 * stack; `constructor`, `toString` and the rest are not nodes at all. A deny
 * list cannot name every method of a class; an allow-list needs no such list.
 *
 * Derived from two sources, then crossed:
 *  - what the editor can produce (`@maily-to/core` 0.3.7): the nodes of
 *    TipTap's StarterKit as `MailyKit` configures it (document, paragraph,
 *    heading, blockquote, bulletList, orderedList, listItem, hardBreak,
 *    horizontalRule, text), its own Footer, Spacer, Button, Image, Logo,
 *    LinkCard, Section, Columns, Column and Repeat, and the editor's
 *    InlineImage and Variable. `repeat` is the one left out of the list
 *    below: it loops over a list the email's data never carries, so it draws
 *    nothing here, and it throws when its `each` is not what it expects. Its slash menu (`DEFAULT_SLASH_COMMANDS`) adds
 *    no other type. `htmlCodeBlock` is in it too and is left out on purpose.
 *    StarterKit's `codeBlock` is left out as well: the renderer has no
 *    method for it, so a document holding one could never be sent.
 *  - what the renderer builds (`@maily-to/render` 0.2.3): the methods that
 *    render a node are paragraph, text, heading, variable, horizontalRule,
 *    orderedList, bulletList, listItem, button, spacer, hardBreak, logo,
 *    image, footer, blockquote, linkCard, section, columns, column, repeat,
 *    for, htmlCodeBlock and inlineImage. `for` is an alias of `repeat` the
 *    editor never writes; `doc` is the root and only the root. `code` is a
 *    MARK (see below).
 *
 * Every node in the first list that the renderer can draw and an email can
 * use is here.
 */
export const ALLOWED_NODES: ReadonlySet<string> = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "variable",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "button",
  "image",
  "inlineImage",
  "logo",
  "linkCard",
  "section",
  "columns",
  "column",
  "spacer",
  "horizontalRule",
  "footer",
]);

/**
 * The marks: they go through the same method dispatch in the renderer
 * (`renderMark`), so they get the same allow-list. The editor's are bold,
 * italic, underline, strike, code, textStyle (colour) and link.
 */
export const ALLOWED_MARKS: ReadonlySet<string> = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "textStyle",
  "link",
]);

export type DocProblem = {
  /**
   * `blockNotAllowed`: a raw-HTML block, a node or mark off the allow-list, or
   * a block set to show conditionally. `linkNotAllowed`: a bad address.
   */
  kind: "blockNotAllowed" | "linkNotAllowed";
  /** Where in the document, e.g. `content[2].marks[0]`. */
  path: string;
  /** The node type, or the mark. */
  node: string;
  /** The offending address, for `linkNotAllowed`. */
  value?: string;
};

const LINK_OK = /^(?:https?:|mailto:)/i;
const IMAGE_OK = /^https?:/i;
// The renderer strips the first `http(s)://` it finds, twice.
const PROTOCOL = /https?:\/\//;
const VARIABLE_PREFIX = /^\{\{\s*[a-z_][a-z0-9_]*\s*\}\}/i;
const COLOR =
  /^(?:#[0-9a-f]{3,8}|[a-z]{3,20}|(?:rgb|hsl)a?\([0-9\s.,%/deg]+\))$/i;

const has = (values: Record<string, string>, name: string) =>
  Object.prototype.hasOwnProperty.call(values, name);

/** The address a variable-typed link stands for, as the renderer would find it. */
function variableName(raw: string): string {
  return raw.replace(PROTOCOL, "").replace(PROTOCOL, "").trim();
}

/** An address with its variables filled in, or "" when there is none to fill. */
function resolve(
  raw: unknown,
  isVariable: unknown,
  values: Record<string, string>,
): string {
  if (typeof raw !== "string") return "";
  if (isVariable) {
    const name = variableName(raw);
    return has(values, name) ? (values[name] ?? "").trim() : "";
  }
  return renderVariables(raw, values, { escape: false }).trim();
}

const safeLink = (url: string) => (LINK_OK.test(url) ? url : "#");

// How a link card names a variable: the renderer looks its address up among
// the variables by name before using it as an address.
const BARE_NAME = /^[a-z_][a-z0-9_]*$/i;
/**
 * An address that is a variable's: the editor's flag ("this link is a
 * variable"), one `{{token}}` on its own, or one followed by something
 * (`{{consent_url}}?x=1`: without the variable only the tail is left, which is
 * no address). A fixed address with a token further in is a fixed address.
 */
const isVariableAddress = (raw: unknown, isVariable: unknown) =>
  Boolean(isVariable) ||
  (typeof raw === "string" && VARIABLE_PREFIX.test(raw.trim()));

// ── sanitising ──────────────────────────────────────────────────────────────

// Attributes the renderer writes into inline `style`, some of them inside a
// template (`${width}px`), where a string such as `1px;background:url(//x)`
// would add declarations. They keep a number (with an optional unit) or one of
// the words the editor offers, and lose anything else.
const NUMBER = /^-?\d+(?:\.\d+)?(?:px|%|em|rem)?$/;
const NUMERIC_ATTRS: ReadonlySet<string> = new Set([
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "borderRadius",
  "borderWidth",
  "width",
  "height",
  "gap",
  "size",
]);
const LEFT_RIGHT = ["left", "center", "right"];
const WORD_ATTRS: Record<string, ReadonlySet<string>> = {
  alignment: new Set(LEFT_RIGHT),
  align: new Set(LEFT_RIGHT),
  textAlign: new Set([...LEFT_RIGHT, "justify"]),
  verticalAlign: new Set(["top", "middle", "bottom"]),
  textDirection: new Set(["ltr", "rtl"]),
  variant: new Set(["filled", "outline"]),
  borderRadius: new Set(["sharp", "smooth", "round"]),
  size: new Set(["sm", "md", "lg"]),
  width: new Set(["auto"]),
  height: new Set(["auto"]),
};

function cleanStyleValues(attrs: Record<string, unknown>) {
  for (const key of Object.keys(attrs)) {
    const numeric = NUMERIC_ATTRS.has(key);
    const words = WORD_ATTRS[key];
    if (!numeric && !words) continue;
    const value = attrs[key];
    const ok =
      (numeric &&
        ((typeof value === "number" && Number.isFinite(value)) ||
          (typeof value === "string" && NUMBER.test(value.trim())))) ||
      (words !== undefined && typeof value === "string" && words.has(value));
    if (!ok) delete attrs[key];
  }
}

function cleanColours(attrs: Record<string, unknown>) {
  for (const key of Object.keys(attrs)) {
    if (key !== "color" && !key.endsWith("Color")) continue;
    const value = attrs[key];
    if (typeof value === "string" && !COLOR.test(value.trim()))
      delete attrs[key];
  }
}

/**
 * A known node in a place it may be: `doc` is the root and only the root. A
 * `doc` nested inside a document makes the renderer throw, and the whole
 * email would fall back to the legacy one without a word.
 */
function isAllowedNode(node: unknown, isRoot: boolean): node is EmailDoc {
  if (typeof node !== "object" || node === null) return false;
  const type = (node as { type?: unknown }).type;
  return (
    typeof type === "string" &&
    ALLOWED_NODES.has(type) &&
    (type === "doc") === isRoot
  );
}

function cleanNode(
  node: EmailDoc,
  values: Record<string, string>,
  isRoot = false,
): EmailDoc | null {
  // Anything that is not a known node is dropped with everything under it.
  if (!isAllowedNode(node, isRoot)) return null;

  const next: EmailDoc = { ...node };

  if (node.attrs) {
    const attrs: Record<string, unknown> = { ...node.attrs };
    cleanColours(attrs);
    cleanStyleValues(attrs);
    // No payload is ever set, so a condition could only ever hide the block.
    delete attrs.showIfKey;

    switch (node.type) {
      case "button": {
        const url = resolve(attrs.url, attrs.isUrlVariable, values);
        // A variable that holds no address this time: no button, rather than
        // one that leads nowhere.
        if (
          !LINK_OK.test(url) &&
          isVariableAddress(attrs.url, attrs.isUrlVariable)
        ) {
          return null;
        }
        attrs.url = safeLink(url);
        attrs.isUrlVariable = false;
        break;
      }
      case "image":
      case "inlineImage":
      case "logo": {
        const src = resolve(attrs.src, attrs.isSrcVariable, values);
        if (!IMAGE_OK.test(src)) return null;
        attrs.src = src;
        attrs.isSrcVariable = false;
        if (node.type !== "logo" && "externalLink" in attrs) {
          const link = resolve(
            attrs.externalLink,
            attrs.isExternalLinkVariable,
            values,
          );
          attrs.externalLink = LINK_OK.test(link) ? link : "";
          attrs.isExternalLinkVariable = false;
        }
        break;
      }
      case "linkCard": {
        // The renderer looks the address up among the variables by name first.
        const raw = typeof attrs.link === "string" ? attrs.link : "";
        const link = has(values, raw.trim())
          ? (values[raw.trim()] ?? "").trim()
          : resolve(raw, false, values);
        // A card whose address is a variable (its bare name, which is never
        // an address by itself, or a token it starts with) goes the way of
        // such a button when the variable holds no address this time.
        if (
          !LINK_OK.test(link) &&
          (BARE_NAME.test(raw.trim()) || isVariableAddress(raw, false))
        ) {
          return null;
        }
        attrs.link = safeLink(link);
        if (typeof attrs.image === "string" && attrs.image !== "") {
          const image = resolve(attrs.image, false, values);
          attrs.image = IMAGE_OK.test(image) ? image : "";
        }
        break;
      }
    }
    next.attrs = attrs;
  }

  if (node.marks) {
    // A mark that is not a known one is dropped; the text keeps showing. So is
    // a link whose address is a variable that holds no address this time.
    next.marks = node.marks
      .filter(
        (mark) =>
          typeof mark === "object" &&
          mark !== null &&
          typeof mark.type === "string" &&
          ALLOWED_MARKS.has(mark.type),
      )
      .filter(
        (mark) =>
          mark.type !== "link" ||
          !mark.attrs ||
          !isVariableAddress(mark.attrs.href, mark.attrs.isUrlVariable) ||
          LINK_OK.test(
            resolve(mark.attrs.href, mark.attrs.isUrlVariable, values),
          ),
      )
      .map((mark) => {
        if (!mark.attrs) return mark;
        const attrs: Record<string, unknown> = { ...mark.attrs };
        cleanColours(attrs);
        cleanStyleValues(attrs);
        if (mark.type === "link") {
          attrs.href = safeLink(
            resolve(attrs.href, attrs.isUrlVariable, values),
          );
          attrs.isUrlVariable = false;
        }
        return { ...mark, attrs };
      });
  }

  if (node.content) {
    next.content = node.content
      .map((child) => cleanNode(child, values, false))
      .filter((child): child is EmailDoc => child !== null);
  }
  return next;
}

/**
 * The document as it may be rendered, with `values` the variables the render
 * will fill. Never throws on an odd document: what it cannot make safe it
 * removes.
 */
export function sanitizeDoc(
  doc: EmailDoc,
  values: Record<string, string>,
): EmailDoc {
  return cleanNode(doc, values, true) ?? { type: "doc", content: [] };
}

// ── checking, for saving ───────────────────────────────────────────────────

/** An address that can be judged now: a variable's value cannot, so it passes. */
function literalOk(
  raw: unknown,
  isVariable: unknown,
  allowed: RegExp,
): boolean {
  if (typeof raw !== "string" || isVariable) return true;
  const url = raw.trim();
  return (
    url === "" || url === "#" || VARIABLE_PREFIX.test(url) || allowed.test(url)
  );
}

/**
 * Everything in the document that `sanitizeDoc` would remove or rewrite, with
 * where it is: a node or mark that is not on the allow-list is a
 * `blockNotAllowed`, an address that cannot leave a `linkNotAllowed`. Empty means the document is fine to save. A link whose address
 * is a variable (or starts with one) is not judged here: its value is only
 * known when the email is sent, where `sanitizeDoc` checks it.
 */
export function findForbiddenNodes(doc: EmailDoc): DocProblem[] {
  const problems: DocProblem[] = [];

  const visit = (node: EmailDoc, path: string, isRoot: boolean) => {
    // Not a known node (or a `doc` that is not the root): reported, and not
    // looked into, because sending drops it with everything under it.
    if (!isAllowedNode(node, isRoot)) {
      problems.push({
        kind: "blockNotAllowed",
        path,
        node: String((node as { type?: unknown } | null)?.type ?? ""),
      });
      return;
    }
    const a = node.attrs ?? {};
    // A condition the renderer would act on (it ignores an empty one, which
    // is what the editor writes on every block): the block would never go out.
    if (a.showIfKey) {
      problems.push({ kind: "blockNotAllowed", path, node: node.type });
    }
    const bad = (value: unknown, where: string, nodeName: string) =>
      problems.push({
        kind: "linkNotAllowed",
        path: where,
        node: nodeName,
        value: typeof value === "string" ? value : undefined,
      });

    if (node.type === "button" && !literalOk(a.url, a.isUrlVariable, LINK_OK)) {
      bad(a.url, path, node.type);
    }
    if (["image", "inlineImage", "logo"].includes(node.type)) {
      if (!literalOk(a.src, a.isSrcVariable, IMAGE_OK))
        bad(a.src, path, node.type);
      if (
        node.type !== "logo" &&
        !literalOk(a.externalLink, a.isExternalLinkVariable, LINK_OK)
      ) {
        bad(a.externalLink, path, node.type);
      }
    }
    if (node.type === "linkCard") {
      // A card's address may be the name of a variable: the renderer looks it
      // up before using it as an address.
      const named = typeof a.link === "string" && BARE_NAME.test(a.link.trim());
      if (!named && !literalOk(a.link, false, LINK_OK)) {
        bad(a.link, path, node.type);
      }
      if (!literalOk(a.image, false, IMAGE_OK)) bad(a.image, path, node.type);
    }
    (node.marks ?? []).forEach((mark, i) => {
      if (
        typeof mark !== "object" ||
        mark === null ||
        typeof mark.type !== "string" ||
        !ALLOWED_MARKS.has(mark.type)
      ) {
        problems.push({
          kind: "blockNotAllowed",
          path: `${path}.marks[${i}]`,
          node: String((mark as { type?: unknown } | null)?.type ?? ""),
        });
        return;
      }
      if (
        mark.type === "link" &&
        !literalOk(mark.attrs?.href, mark.attrs?.isUrlVariable, LINK_OK)
      ) {
        bad(mark.attrs?.href, `${path}.marks[${i}]`, "link");
      }
    });
    (node.content ?? []).forEach((child, i) =>
      visit(child, `${path ? `${path}.` : ""}content[${i}]`, false),
    );
  };

  visit(doc, "", true);
  return problems;
}
