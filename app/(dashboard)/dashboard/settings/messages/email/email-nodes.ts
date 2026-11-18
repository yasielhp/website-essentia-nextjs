import { Extension, Node, mergeAttributes, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { BLOCK_NODE, KICKER_NODE, TITLE_NODE } from "@/lib/messages/email-doc";

/**
 * The three nodes an email's document has besides the editor's own: its kicker
 * (the small line above the title), its title and the blocks the system adds (see `@/lib/messages/email-doc`). Here they are the
 * editor's: how they are held, moved and protected. How they are drawn is the
 * view each is given (`email-node-views.tsx`, which extends these).
 *
 * What the editor guarantees, whatever the keyboard, the mouse or a paste does:
 * one title, which stays first (under the kicker, when there is one); at most
 * one kicker, which stays the very first thing; each block at most once; and
 * none of them ever sits inside anything else. A change that would break one of those is refused
 * whole (the keystroke does nothing). Any block can be removed, a required one
 * too: the page then says the email lacks it and does not let it be saved, and
 * the server checks the same again when it is saved and sent.
 */

type Census = {
  titles: number;
  kickers: number;
  kickerFirst: boolean;
  /** The title is first, or second under a first kicker. */
  titleAtTop: boolean;
  kinds: Map<string, number>;
  /** A title or a block below the top level. */
  nested: boolean;
};

function census(doc: PMNode): Census {
  const kinds = new Map<string, number>();
  let titles = 0;
  let kickers = 0;
  let nested = false;
  doc.descendants((node, _pos, parent) => {
    const special =
      node.type.name === TITLE_NODE ||
      node.type.name === KICKER_NODE ||
      node.type.name === BLOCK_NODE;
    if (special && parent?.type.name !== "doc") nested = true;
    if (node.type.name === TITLE_NODE) titles += 1;
    if (node.type.name === KICKER_NODE) kickers += 1;
    if (node.type.name === BLOCK_NODE) {
      const kind = String(node.attrs.kind);
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
    return true;
  });
  const kickerFirst = doc.firstChild?.type.name === KICKER_NODE;
  return {
    titles,
    kickers,
    kickerFirst,
    titleAtTop:
      doc.firstChild?.type.name === TITLE_NODE ||
      (kickerFirst && doc.maybeChild(1)?.type.name === TITLE_NODE),
    kinds,
    nested,
  };
}

/**
 * Whether a change from `prev` to `next` keeps the rules. Pure over documents,
 * so it is tested without an editor. A rule the previous document already
 * broke (it came from somewhere else) is not made worse, and not demanded.
 */
export function changeAllowed(prev: PMNode, next: PMNode): boolean {
  const before = census(prev);
  const after = census(next);
  if (after.nested) return false;
  // One title, and it stays: neither removed nor doubled.
  if (before.titles === 1 && after.titles !== 1) return false;
  if (after.titles > Math.max(before.titles, 1)) return false;
  // It stays at the top: first, or right under the kicker.
  if (before.titleAtTop && !after.titleAtTop) return false;
  // The kicker, once there is one, stays, is not doubled, and is the very first
  // thing: the order of the document is the order of the email.
  if (before.kickers === 1 && after.kickers !== 1) return false;
  if (after.kickers > Math.max(before.kickers, 1)) return false;
  if (
    after.kickers > 0 &&
    !after.kickerFirst &&
    (before.kickers === 0 || before.kickerFirst)
  ) {
    return false;
  }
  for (const [kind, count] of after.kinds) {
    // A block twice, where it was not twice before, is refused.
    if (count > Math.max(before.kinds.get(kind) ?? 0, 1)) return false;
  }
  return true;
}

const guardKey = new PluginKey("emailDocGuard");

/** The extension that refuses a change that breaks the rules. */
export const EmailDocGuard = Extension.create({
  name: "emailDocGuard",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: guardKey,
        filterTransaction: (tr, state) =>
          !tr.docChanged || changeAllowed(state.doc, tr.doc),
      }),
    ];
  },
});

// ── moving a block ─────────────────────────────────────────────────────────

/** The top-level index of the node that starts at `pos`, or -1. */
function indexAt(doc: PMNode, pos: number): number {
  let offset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    if (offset === pos) return i;
    offset += doc.child(i).nodeSize;
  }
  return -1;
}

/**
 * The state after moving the block at `pos` one place up or down among the
 * top-level nodes, or null when it cannot move (it is at an end, or the
 * place above is the title or the kicker, which stay at the top). The caller
 * dispatches it.
 */
export function moveBlockTransaction(
  state: EditorState,
  pos: number,
  direction: "up" | "down",
) {
  const { doc } = state;
  const index = indexAt(doc, pos);
  if (index === -1) return null;
  const node = doc.child(index);
  if (direction === "up") {
    if (index === 0) return null;
    const above = doc.child(index - 1);
    if (above.type.name === TITLE_NODE || above.type.name === KICKER_NODE) {
      return null;
    }
    const target = pos - above.nodeSize;
    return state.tr.delete(pos, pos + node.nodeSize).insert(target, node);
  }
  if (index === doc.childCount - 1) return null;
  const below = doc.child(index + 1);
  const end = pos + node.nodeSize + below.nodeSize;
  // Inserted after the next node first, then the original is cut: nothing
  // before the original moves, so `pos` is still where it was.
  return state.tr.insert(end, node).delete(pos, pos + node.nodeSize);
}

/** Whether a block at `pos` has somewhere to go in that direction. */
export function canMove(
  doc: PMNode,
  pos: number,
  direction: "up" | "down",
): boolean {
  const index = indexAt(doc, pos);
  if (index === -1) return false;
  if (direction === "down") return index < doc.childCount - 1;
  if (index <= 0) return false;
  const above = doc.child(index - 1).type.name;
  return above !== TITLE_NODE && above !== KICKER_NODE;
}

// ── the nodes ──────────────────────────────────────────────────────────────

/** Enter in a line of the email (the kicker, the title) goes on to the next one. */
function enterGoesOn(name: string) {
  return ({ editor }: { editor: Editor }) => {
    const { $from } = editor.state.selection;
    if ($from.parent.type.name !== name) return false;
    const after = $from.after();
    const next = editor.state.doc.nodeAt(after);
    if (next?.isTextblock) {
      return editor
        .chain()
        .setTextSelection(after + 1)
        .run();
    }
    return editor
      .chain()
      .insertContentAt(after, { type: "paragraph" })
      .setTextSelection(after + 1)
      .run();
  };
}

/**
 * The kicker: the small line in capitals above the title. Text and variables,
 * nothing else, at most one per document, and the first thing in it. It may be
 * empty, and then the email prints nothing.
 */
export const EmailKickerNode = Node.create({
  name: KICKER_NODE,
  group: "block",
  content: "(text|variable)*",
  marks: "",
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: "p[data-email-kicker]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, { "data-email-kicker": "" }),
      0,
    ];
  },
  addKeyboardShortcuts() {
    return { Enter: enterGoesOn(KICKER_NODE) };
  },
});

/** The title of the email: text and variables, nothing else, one per document. */
export const EmailTitleNode = Node.create({
  name: TITLE_NODE,
  group: "block",
  // The variables of the editor are inline nodes; text carries no marks here.
  content: "(text|variable)*",
  marks: "",
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: "h1[data-email-title]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "h1",
      mergeAttributes(HTMLAttributes, { "data-email-title": "" }),
      0,
    ];
  },
  addKeyboardShortcuts() {
    // A title is one line: Enter goes on to the text under it.
    return { Enter: enterGoesOn(TITLE_NODE) };
  },
});

/** A block the system adds: it has a kind and nothing else, and it is not edited. */
export const SystemBlockNode = Node.create({
  name: BLOCK_NODE,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      kind: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-kind"),
        renderHTML: (attributes) =>
          attributes.kind ? { "data-kind": String(attributes.kind) } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-system-block]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-system-block": "" }),
    ];
  },
});
