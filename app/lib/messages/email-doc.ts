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
 * Three node types exist besides the editor's own, and only at the top level of
 * the document, never inside a section, a column or a list:
 *
 *  - `emailKicker`: the small line in capitals ABOVE the title ("Booking
 *    confirmed"). The same inline content as the title (text and variables, no
 *    marks, no attributes), at most one, and when there is one it is FIRST. It may
 *    be empty, and then nothing is printed. The order of the document is the
 *    order of the email: kicker, title, text, blocks.
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

export const KICKER_NODE = "emailKicker";
export const TITLE_NODE = "emailTitle";
export const BLOCK_NODE = "systemBlock";

/** The three node types of this module. */
export const SPECIAL_NODES: ReadonlySet<string> = new Set([
  KICKER_NODE,
  TITLE_NODE,
  BLOCK_NODE,
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isTitleNode = (node: unknown): boolean =>
  isObject(node) && node.type === TITLE_NODE;

export const isKickerNode = (node: unknown): boolean =>
  isObject(node) && node.type === KICKER_NODE;

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

/** The kicker, from text with `{{variables}}` in it: the same nodes as a title's. */
export function kickerNodeFrom(text: string): EmailDoc {
  return { ...titleNodeFrom(text), type: KICKER_NODE };
}

/** Whether a title or a kicker says nothing: no text but spaces, and no variable. */
const lineIsEmpty = (node: EmailDoc): boolean =>
  !(node.content ?? []).some(
    (child) =>
      isObject(child) &&
      ((child.type === "text" &&
        typeof child.text === "string" &&
        child.text.trim() !== "") ||
        child.type === "variable"),
  );

export const kickerIsEmpty = lineIsEmpty;

/** A title or kicker as text with `{{variables}}`, the form the preheader falls back to. */
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

/** The first kicker of a document, if it has one at the top level. */
export const docKicker = (doc: EmailDoc | null | undefined) =>
  topLevel(doc).find(isKickerNode);

/**
 * The document with an empty kicker first when it has none, so the editor has
 * a line to write it in. Saying nothing, it is not a change (see `sameDoc`).
 */
export function withKickerSlot(doc: EmailDoc): EmailDoc {
  if (docKicker(doc)) return doc;
  return {
    ...doc,
    content: [
      { type: KICKER_NODE },
      ...(Array.isArray(doc.content) ? doc.content : []),
    ],
  };
}

/** The document without its top-level kickers that say nothing. */
export function withoutEmptyKicker(doc: EmailDoc): EmailDoc {
  if (!Array.isArray(doc.content)) return doc;
  const kept = doc.content.filter(
    (node) => !(isKickerNode(node) && lineIsEmpty(node)),
  );
  return kept.length === doc.content.length ? doc : { ...doc, content: kept };
}

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
 * The document a message opens with: its kicker and title, its text, and every
 * block it has placed where its email prints it, the closing sentence between the blocks
 * that come before it and the ones after.
 */
export function buildMessageDoc({
  key,
  kicker = null,
  title,
  intro,
  outro,
}: {
  key: MessageKey;
  /** The line above the title; none when null or blank. */
  kicker?: string | null;
  title: string;
  intro: EmailDoc;
  outro: EmailDoc | null;
}): EmailDoc {
  const { before, after } = layoutOf(key);
  return {
    type: "doc",
    content: [
      ...(kicker !== null && kicker.trim() !== ""
        ? [kickerNodeFrom(kicker)]
        : []),
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
    // No title of its own, or the default's own words: the default document.
    if (title === null || title === defaults.title.trim()) return defaults.doc;
    // The default document, under the title the admin wrote. A row like this
    // always sent its first line UNDER the title, so that is where it stays:
    // the default's kicker becomes the paragraph it was, not a line above.
    const out: EmailDoc[] = [];
    let replaced = false;
    for (const node of defaults.doc.content ?? []) {
      if (isKickerNode(node)) continue;
      if (!replaced && isTitleNode(node)) {
        replaced = true;
        out.push(titleNodeFrom(title));
        const line = docKicker(defaults.doc);
        if (line && !lineIsEmpty(line)) {
          out.push({
            type: "paragraph",
            content: line.content,
          });
        }
        continue;
      }
      out.push(node);
    }
    return { ...defaults.doc, content: out };
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
      /** More than one kicker. */
      kind: "kickerOne";
      path: "";
    }
  | {
      /** The kicker is not the first thing in the document. */
      kind: "kickerMisplaced";
      path: string;
    }
  | {
      /** The title has nothing in it: no text but spaces, and no variable. */
      kind: "titleEmpty";
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
 * not one title, a title or a kicker with anything but text and variables in it,
 * more than one kicker or one that is not first, a block
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

  // A title and a kicker are one line of text and variables each: no
  // attributes (the send ignores them), no marks, nothing else inside.
  const lineProblems = (node: EmailDoc, path: string, type: string) => {
    if (Object.keys(node.attrs ?? {}).length > 0) {
      problems.push({ kind: "blockNotAllowed", path, node: type });
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
  };

  let kickers = 0;
  nodes.forEach((node, i) => {
    const path = `content[${i}]`;
    if (isKickerNode(node)) {
      kickers += 1;
      if (kickers > 1) {
        problems.push({ kind: "kickerOne", path: "" });
        return;
      }
      // Only first: the order of the document is the order of the email.
      if (i !== 0) problems.push({ kind: "kickerMisplaced", path });
      lineProblems(node, path, KICKER_NODE);
      return;
    }
    if (isTitleNode(node)) {
      titles += 1;
      if (titles > 1) {
        problems.push({ kind: "titleOne", path: "" });
      }
      if (lineIsEmpty(node)) problems.push({ kind: "titleEmpty", path: "" });
      lineProblems(node, path, TITLE_NODE);
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
      isKickerNode(node) || isTitleNode(node) || isBlockNode(node)
        ? { type: "paragraph" }
        : node,
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
 *  - the first kicker stays and any other goes, and it is moved up to the very
 *    top if it was found anywhere else: it is never lost, only put where the
 *    email has it;
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
  let kicker: EmailDoc | null = null;

  // A line of the email keeps only text and the variables the message offers.
  const cleanLine = (type: string, node: EmailDoc): EmailDoc => ({
    type,
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
  });

  for (const node of topLevel(doc)) {
    if (isKickerNode(node)) {
      // The first one stays, wherever it was found, and goes up front below.
      if (!kicker) kicker = cleanLine(KICKER_NODE, node);
      continue;
    }
    if (isTitleNode(node)) {
      if (title) continue;
      title = cleanLine(TITLE_NODE, node);
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
  // The kicker is the line above the title: first, always.
  if (kicker) out.unshift(kicker);
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
