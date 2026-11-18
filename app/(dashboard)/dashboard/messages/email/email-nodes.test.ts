import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorState, NodeSelection } from "@tiptap/pm/state";
import { VariableExtension } from "@maily-to/core/extensions";
import {
  EmailDocGuard,
  EmailTitleNode,
  SystemBlockNode,
  canMove,
  changeAllowed,
  moveBlockTransaction,
} from "./email-nodes";

const extensions = [
  Document,
  Paragraph,
  Text,
  Blockquote,
  VariableExtension,
  EmailTitleNode,
  SystemBlockNode,
  EmailDocGuard.configure({ required: new Set(["cancel_link"]) }),
];
const schema = getSchema(extensions);
const RULES = { required: new Set(["cancel_link"]) };

const title = (text = "Hola") => ({
  type: "emailTitle",
  content: [{ type: "text", text }],
});
const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const block = (kind: string) => ({ type: "systemBlock", attrs: { kind } });
const doc = (...content: object[]) =>
  schema.nodeFromJSON({ type: "doc", content });

const DOC = () =>
  doc(title(), para("Texto"), block("details_card"), block("cancel_link"));

describe("the schema", () => {
  test("a title holds text and variables, and no marks", () => {
    const t = schema.nodes.emailTitle!;
    expect(t.spec.content).toBe("(text|variable)*");
    expect(t.spec.marks).toBe("");
    expect(t.spec.isolating).toBe(true);
  });
  test("a block is an atom that can be dragged, with a kind and no content", () => {
    const b = schema.nodes.systemBlock!;
    expect(b.isAtom).toBe(true);
    expect(b.spec.draggable).toBe(true);
    expect(Object.keys(b.spec.attrs ?? {})).toEqual(["kind"]);
    expect(b.spec.content).toBeUndefined();
  });
  test("both are read from and written to JSON as the server expects them", () => {
    const d = DOC().toJSON();
    expect(d.content[0]).toEqual({
      type: "emailTitle",
      content: [{ type: "text", text: "Hola" }],
    });
    expect(d.content[2]).toEqual({
      type: "systemBlock",
      attrs: { kind: "details_card" },
    });
  });
  test("a variable can be in the title", () => {
    expect(() =>
      doc({
        type: "emailTitle",
        content: [{ type: "variable", attrs: { id: "first_name" } }],
      }),
    ).not.toThrow();
  });
});

describe("changeAllowed: what the editor refuses", () => {
  const ok = (next: ReturnType<typeof doc>) =>
    changeAllowed(DOC(), next, RULES);

  test("taking away a block that cannot go is refused", () => {
    expect(ok(doc(title(), para("Texto"), block("details_card")))).toBe(false);
  });
  test("taking away a block that only informs is allowed", () => {
    expect(ok(doc(title(), para("Texto"), block("cancel_link")))).toBe(true);
  });
  test("moving a block, even a required one, is allowed: it is the same set", () => {
    expect(
      ok(
        doc(
          title(),
          block("cancel_link"),
          para("Texto"),
          block("details_card"),
        ),
      ),
    ).toBe(true);
    expect(
      ok(
        doc(
          title(),
          block("cancel_link"),
          block("details_card"),
          para("Texto"),
        ),
      ),
    ).toBe(true);
  });
  test("a block twice is refused; so is a second title; so is no title", () => {
    expect(
      ok(
        doc(
          title(),
          para("T"),
          block("details_card"),
          block("details_card"),
          block("cancel_link"),
        ),
      ),
    ).toBe(false);
    expect(
      ok(
        doc(
          title(),
          title("Otro"),
          block("details_card"),
          block("cancel_link"),
        ),
      ),
    ).toBe(false);
    expect(
      ok(doc(para("Texto"), block("details_card"), block("cancel_link"))),
    ).toBe(false);
  });
  test("the title stays first", () => {
    expect(
      ok(
        doc(
          para("Texto"),
          title(),
          block("details_card"),
          block("cancel_link"),
        ),
      ),
    ).toBe(false);
  });
  test("a block or a title inside anything else is refused", () => {
    const nestedBlock = doc(
      title(),
      { type: "blockquote", content: [block("details_card")] },
      block("cancel_link"),
    );
    expect(ok(nestedBlock)).toBe(false);
    const nestedTitle = doc(
      title(),
      { type: "blockquote", content: [title("x")] },
      block("details_card"),
      block("cancel_link"),
    );
    expect(ok(nestedTitle)).toBe(false);
  });
  test("text is free: typing, adding paragraphs and deleting them", () => {
    expect(
      ok(
        doc(
          title("Otro título"),
          para("Más"),
          para("y más"),
          block("details_card"),
          block("cancel_link"),
        ),
      ),
    ).toBe(true);
    expect(ok(doc(title(), block("details_card"), block("cancel_link")))).toBe(
      true,
    );
  });
  test("what was already wrong is not made worse, and is not demanded", () => {
    const broken = doc(para("sin título"), block("details_card"));
    expect(
      changeAllowed(
        broken,
        doc(para("otra cosa"), block("details_card")),
        RULES,
      ),
    ).toBe(true);
    expect(
      changeAllowed(
        broken,
        doc(title(), para("a"), block("details_card")),
        RULES,
      ),
    ).toBe(true);
  });
});

describe("the guard inside a state", () => {
  const state = () => EditorState.create({ doc: DOC(), plugins: [] });

  test("a change that breaks a rule does nothing; one that does not goes through", () => {
    const withPlugin = EditorState.create({
      doc: DOC(),
      plugins: EmailDocGuard.configure({
        required: new Set(["cancel_link"]),
      }).config.addProseMirrorPlugins!.call({
        options: { required: new Set(["cancel_link"]) },
      } as never),
    });
    // The last node is the required block.
    const last = withPlugin.doc.lastChild!;
    const from = withPlugin.doc.content.size - last.nodeSize;
    const refused = withPlugin.applyTransaction(
      withPlugin.tr.delete(from, from + last.nodeSize),
    );
    expect(refused.state.doc.eq(withPlugin.doc)).toBe(true);
    // Cutting a selected block is the same deletion.
    const selected = withPlugin.tr
      .setSelection(NodeSelection.create(withPlugin.doc, from))
      .deleteSelection();
    expect(
      withPlugin.applyTransaction(selected).state.doc.eq(withPlugin.doc),
    ).toBe(true);
    // The block that only informs can go.
    const infoFrom =
      withPlugin.doc.content.size -
      last.nodeSize -
      withPlugin.doc.child(2).nodeSize;
    const allowed = withPlugin.applyTransaction(
      withPlugin.tr.delete(
        infoFrom,
        infoFrom + withPlugin.doc.child(2).nodeSize,
      ),
    );
    expect(allowed.state.doc.childCount).toBe(3);
    expect(state().doc.childCount).toBe(4);
  });
});

describe("moving a block", () => {
  const start = () => EditorState.create({ doc: DOC() });
  const posOf = (s: EditorState, i: number) => {
    let pos = 0;
    for (let k = 0; k < i; k++) pos += s.doc.child(k).nodeSize;
    return pos;
  };
  const kinds = (s: EditorState) =>
    s.doc.content.content.map((n) =>
      n.type.name === "systemBlock" ? `block:${n.attrs.kind}` : n.type.name,
    );

  test("up and down swap it with its neighbour, and nothing is lost", () => {
    const s = start();
    const up = moveBlockTransaction(s, posOf(s, 3), "up")!;
    expect(kinds(s.apply(up))).toEqual([
      "emailTitle",
      "paragraph",
      "block:cancel_link",
      "block:details_card",
    ]);
    const down = moveBlockTransaction(s, posOf(s, 2), "down")!;
    expect(kinds(s.apply(down))).toEqual([
      "emailTitle",
      "paragraph",
      "block:cancel_link",
      "block:details_card",
    ]);
    // A block can pass over text, too.
    const over = moveBlockTransaction(s, posOf(s, 2), "up")!;
    expect(kinds(s.apply(over))).toEqual([
      "emailTitle",
      "block:details_card",
      "paragraph",
      "block:cancel_link",
    ]);
  });
  test("a block cannot leave the document, and cannot go above the title", () => {
    const s = start();
    expect(moveBlockTransaction(s, posOf(s, 3), "down")).toBeNull();
    const two = EditorState.create({
      doc: doc(title(), block("details_card"), block("cancel_link")),
    });
    expect(moveBlockTransaction(two, posOf(two, 1), "up")).toBeNull();
    expect(canMove(two.doc, posOf(two, 1), "up")).toBe(false);
    expect(canMove(two.doc, posOf(two, 1), "down")).toBe(true);
    expect(canMove(two.doc, posOf(two, 2), "down")).toBe(false);
  });
  test("the moved document passes the guard (a move is not a removal)", () => {
    const s = start();
    const tr = moveBlockTransaction(s, posOf(s, 3), "up")!;
    expect(changeAllowed(s.doc, tr.doc, RULES)).toBe(true);
  });
  test("a position that is not a node's start moves nothing", () => {
    expect(moveBlockTransaction(start(), 1, "up")).toBeNull();
  });
});
