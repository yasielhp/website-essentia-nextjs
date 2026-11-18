import type { EmailDoc } from "@/types/campaign";
import {
  MESSAGE_CATALOG,
  isRequiredBlock,
  requiredBlocks,
  type FixedBlock,
  type MessageKey,
} from "./catalog";

/**
 * The document of an email message, whole: the title, the text and the blocks
 * the system adds, in the order the email has. Pure and light (no renderer, no
 * editor), so the browser, the validator and the sender all read the same rules.
 *
 * Two node types exist besides the editor's own, and only at the top level of
 * the document, never inside a section, a column or a list:
 *
 *  - `emailTitle`: the email's title. Inline content (text and variables, no
 *    marks), exactly one per document.
 *  - `systemBlock` with `attrs.kind`: one of the blocks the code draws for that
 *    message (`catalog.fixed`), with nothing in it to edit, each at most once.
 *    The code paints it from the booking's data; it is not Maily's to render.
 *
 * Which blocks cannot be taken out is the catalogue's (`required`).
 */

/** A variable that stands for an address, which the body can only use as a link. */
export const isLinkVariable = (name: string) => name.endsWith("_url");

export const TITLE_NODE = "emailTitle";
export const BLOCK_NODE = "systemBlock";

/** The two node types of this module. */
export const SPECIAL_NODES: ReadonlySet<string> = new Set([
  TITLE_NODE,
  BLOCK_NODE,
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isTitleNode = (node: unknown): boolean =>
  isObject(node) && node.type === TITLE_NODE;

export const isBlockNode = (node: unknown): boolean =>
  isObject(node) && node.type === BLOCK_NODE;

/** The kind a block node carries, or null when it carries none that is a string. */
export function blockKindOf(node: EmailDoc): string | null {
  const kind = node.attrs?.kind;
  return typeof kind === "string" ? kind : null;
}

export const blockNode = (kind: FixedBlock): EmailDoc => ({
  type: BLOCK_NODE,
  attrs: { kind },
});

// ── the title ──────────────────────────────────────────────────────────────

const TOKEN = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;

/**
 * A title from text with `{{variables}}` in it: text nodes and variable nodes,
 * the same nodes the editor makes when a variable is inserted.
 */
export function titleNodeFrom(text: string): EmailDoc {
  const content: EmailDoc[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) content.push({ type: "text", text: text.slice(last, at) });
    content.push({ type: "variable", attrs: { id: match[1]! } });
    last = at + match[0].length;
  }
  if (last < text.length)
    content.push({ type: "text", text: text.slice(last) });
  return { type: TITLE_NODE, content };
}

/** A title as text with `{{variables}}`, the form the preheader falls back to. */
export function titleText(node: EmailDoc | undefined): string {
  return (node?.content ?? [])
    .map((child) => {
      if (child.type === "variable") {
        const id = child.attrs?.id;
        return typeof id === "string" ? `{{${id}}}` : "";
      }
      return typeof child.text === "string" ? child.text : "";
    })
    .join("");
}

const topLevel = (doc: EmailDoc | null | undefined): EmailDoc[] =>
  doc && Array.isArray(doc.content)
    ? doc.content.filter((node) => isObject(node))
    : [];

/** The first title of a document, if it has one at the top level. */
export const docTitle = (doc: EmailDoc | null | undefined) =>
  topLevel(doc).find(isTitleNode);

/** Whether the document is in the current shape: it has its title among its nodes. */
export const isMessageDoc = (doc: EmailDoc | null | undefined): boolean =>
  docTitle(doc) !== undefined;

// ── the order a message has always had ─────────────────────────────────────

/** The blocks that come before the closing sentence, and the ones after it. */
export function layoutOf(key: MessageKey): {
  before: FixedBlock[];
  after: FixedBlock[];
} {
  const def = MESSAGE_CATALOG[key];
  return {
    before: def.fixed.filter((block) => !def.afterClosing.includes(block)),
    after: def.fixed.filter((block) => def.afterClosing.includes(block)),
  };
}

/**
 * The document a message opens with: its title, its text, and every block it
 * has placed where its email prints it, the closing sentence between the blocks
 * that come before it and the ones after.
 */
export function buildMessageDoc({
  key,
  title,
  intro,
  outro,
}: {
  key: MessageKey;
  title: string;
  intro: EmailDoc;
  outro: EmailDoc | null;
}): EmailDoc {
  const { before, after } = layoutOf(key);
  return {
    type: "doc",
    content: [
      titleNodeFrom(title),
      ...(intro.content ?? []),
      ...before.map(blockNode),
      ...(outro?.content ?? []),
      ...after.map(blockNode),
    ],
  };
}

/**
 * A row saved before the title and the blocks were part of the document: its
 * `title` column and a body with no blocks. It becomes one document, so there
 * is one way to compose an email. The body the admin wrote comes first and the
 * blocks follow it in the order the email always had them; a row with no body
 * of its own takes the default document, with the title the row has.
 */
export function convertOldShape(
  saved: { title: string | null; doc: EmailDoc | null },
  key: MessageKey,
  defaults: { title: string; doc: EmailDoc },
): EmailDoc {
  if (isMessageDoc(saved.doc)) return saved.doc!;
  const title = (saved.title ?? "").trim() === "" ? null : saved.title!.trim();
  const body = topLevel(saved.doc);
  if (body.length === 0) {
    if (title === null) return defaults.doc;
    // The default document, under the title the admin wrote.
    let replaced = false;
    return {
      ...defaults.doc,
      content: (defaults.doc.content ?? []).map((node) => {
        if (replaced || !isTitleNode(node)) return node;
        replaced = true;
        return titleNodeFrom(title);
      }),
    };
  }
  const { before, after } = layoutOf(key);
  return {
    type: "doc",
    content: [
      titleNodeFrom(title ?? defaults.title),
      ...body,
      ...before.map(blockNode),
      ...after.map(blockNode),
    ],
  };
}

// ── checking, for saving ───────────────────────────────────────────────────

export type StructureProblem =
  | {
      /** Zero titles or more than one. */
      kind: "titleOne";
      path: "";
    }
  | {
      /** A block the message cannot do without is not in the document. */
      kind: "blockRequired";
      path: "";
      block: FixedBlock;
    }
  | {
      /** The same block twice. */
      kind: "blockRepeated";
      path: string;
      block: FixedBlock;
    }
  | {
      /** A block of another message, one that is not a block, a title or a block with something in it it must not have. */
      kind: "blockNotAllowed";
      path: string;
      node: string;
    };

/** A variable the title may hold: a plain one, never an address. */
function titleVariableOk(child: EmailDoc, key: MessageKey): boolean {
  const id = child.attrs?.id;
  return (
    typeof id === "string" &&
    !isLinkVariable(id) &&
    (MESSAGE_CATALOG[key].variables as readonly string[]).includes(id)
  );
}

/**
 * What is wrong with the document's own structure, for the message it is for:
 * not one title, a title with anything but text and variables in it, a block
 * that is not one of the message's or is repeated or has content, and a block
 * the message cannot do without that is missing. The editor's own nodes are
 * judged elsewhere (`findForbiddenNodes`); a variable the message does not
 * offer is judged with the rest of the text.
 */
export function structureProblems(
  doc: EmailDoc,
  key: MessageKey,
): StructureProblem[] {
  const problems: StructureProblem[] = [];
  const nodes = Array.isArray(doc.content) ? doc.content : [];
  const fixed = MESSAGE_CATALOG[key].fixed as readonly string[];
  const seen = new Set<string>();
  let titles = 0;

  nodes.forEach((node, i) => {
    const path = `content[${i}]`;
    if (isTitleNode(node)) {
      titles += 1;
      if (titles > 1) {
        problems.push({ kind: "titleOne", path: "" });
      }
      (node.content ?? []).forEach((child, j) => {
        const ok =
          isObject(child) &&
          ((child.type === "text" &&
            typeof child.text === "string" &&
            !(child.marks && child.marks.length > 0)) ||
            (child.type === "variable" &&
              titleVariableOk(child, key) &&
              !(child.marks && child.marks.length > 0)));
        // A variable the message does not offer is the text check's to name.
        const unknownName =
          isObject(child) &&
          child.type === "variable" &&
          typeof child.attrs?.id === "string" &&
          !isLinkVariable(child.attrs.id) &&
          !(MESSAGE_CATALOG[key].variables as readonly string[]).includes(
            child.attrs.id,
          );
        if (!ok && !unknownName) {
          problems.push({
            kind: "blockNotAllowed",
            path: `${path}.content[${j}]`,
            node: String((child as { type?: unknown } | null)?.type ?? ""),
          });
        }
      });
      return;
    }
    if (isBlockNode(node)) {
      const kind = blockKindOf(node);
      const extraAttrs = Object.keys(node.attrs ?? {}).some(
        (a) => a !== "kind",
      );
      const hasContent = Array.isArray(node.content) && node.content.length > 0;
      if (kind === null || !fixed.includes(kind) || extraAttrs || hasContent) {
        problems.push({ kind: "blockNotAllowed", path, node: BLOCK_NODE });
        return;
      }
      if (seen.has(kind)) {
        problems.push({
          kind: "blockRepeated",
          path,
          block: kind as FixedBlock,
        });
        return;
      }
      seen.add(kind);
    }
  });

  if (titles === 0) problems.push({ kind: "titleOne", path: "" });
  for (const block of requiredBlocks(key)) {
    if (!seen.has(block))
      problems.push({ kind: "blockRequired", path: "", block });
  }
  return problems;
}

/**
 * The document with its two special node types at the top level swapped for an
 * empty paragraph each, keeping every index, so the editor's own validator (which
 * knows nothing of them) can read the rest and report paths that still point at
 * the right place. Inside anything else they stay, and it reports them.
 */
export function withoutSpecialNodes(doc: EmailDoc): EmailDoc {
  return {
    ...doc,
    content: (Array.isArray(doc.content) ? doc.content : []).map((node) =>
      isTitleNode(node) || isBlockNode(node) ? { type: "paragraph" } : node,
    ),
  };
}

// ── repairing, for sending ─────────────────────────────────────────────────

/**
 * The document as it may go out, for the message it is for. A saved document
 * should already be in order (it was checked when saved); if it is not, an email
 * must still never go out without what it needs:
 *
 *  - the first title stays and any other goes; with none, the default one is put
 *    first;
 *  - a block that is not one of the message's, or has content, or repeats, goes;
 *  - a required block that is missing is added at the end, in the order the
 *    message has always had its blocks.
 *
 * The title keeps only text and the variables the message offers (no marks, no
 * address). Everything else is left for the sanitiser to judge.
 */
export function repairForSending(
  doc: EmailDoc,
  key: MessageKey,
  defaultTitle: string,
): EmailDoc {
  const fixed = MESSAGE_CATALOG[key].fixed as readonly string[];
  const offered = MESSAGE_CATALOG[key].variables as readonly string[];
  const out: EmailDoc[] = [];
  const seen = new Set<string>();
  let title: EmailDoc | null = null;

  for (const node of topLevel(doc)) {
    if (isTitleNode(node)) {
      if (title) continue;
      title = {
        type: TITLE_NODE,
        content: (node.content ?? [])
          .filter(isObject)
          .flatMap((child): EmailDoc[] => {
            if (child.type === "text" && typeof child.text === "string") {
              return [{ type: "text", text: child.text }];
            }
            const id = child.attrs?.id;
            return child.type === "variable" &&
              typeof id === "string" &&
              !isLinkVariable(id) &&
              offered.includes(id)
              ? [{ type: "variable", attrs: { id } }]
              : [];
          }),
      };
      out.push(title);
      continue;
    }
    if (isBlockNode(node)) {
      const kind = blockKindOf(node);
      if (
        kind === null ||
        !fixed.includes(kind) ||
        (Array.isArray(node.content) && node.content.length > 0) ||
        seen.has(kind)
      ) {
        continue;
      }
      seen.add(kind);
      out.push(blockNode(kind as FixedBlock));
      continue;
    }
    out.push(node);
  }

  if (!title) out.unshift(titleNodeFrom(defaultTitle));
  for (const block of MESSAGE_CATALOG[key].fixed) {
    if (isRequiredBlock(block) && !seen.has(block)) out.push(blockNode(block));
  }
  return { type: "doc", content: out };
}

// ── putting a block back ───────────────────────────────────────────────────

/**
 * Where a block taken out goes when it is put back: right after the last block
 * the document still has that comes before it in the order the message has
 * always had its blocks (so it joins them, ahead of the closing sentence), or
 * else before the first one that comes after it, or at the end when the
 * document has none. `topLevelKinds` is what the document has, node by node: a
 * block's kind, or `null` for anything else.
 */
export function insertIndexFor(
  topLevelKinds: readonly (string | null)[],
  kind: FixedBlock,
  key: MessageKey,
): number {
  const order = MESSAGE_CATALOG[key].fixed as readonly string[];
  const rank = order.indexOf(kind);
  let lastBefore = -1;
  let firstAfter = -1;
  topLevelKinds.forEach((other, index) => {
    if (other === null) return;
    const at = order.indexOf(other);
    if (at === -1) return;
    if (at < rank) lastBefore = index;
    else if (at > rank && firstAfter === -1) firstAfter = index;
  });
  if (lastBefore !== -1) return lastBefore + 1;
  return firstAfter !== -1 ? firstAfter : topLevelKinds.length;
}

/** The blocks of a message that the document does not have (the ones that can be put back). */
export function missingBlocks(doc: EmailDoc, key: MessageKey): FixedBlock[] {
  const present = new Set(
    topLevel(doc)
      .filter(isBlockNode)
      .map((node) => blockKindOf(node)),
  );
  return MESSAGE_CATALOG[key].fixed.filter((block) => !present.has(block));
}
