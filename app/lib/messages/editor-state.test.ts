import { describe, expect, it } from "bun:test";
import type { EmailDoc } from "@/types/campaign";
import {
  changedFields,
  docErrorLines,
  editableLocales,
  flushCurrent,
  insertAtSelection,
  isLinkVariable,
  linkButtonNode,
  variableToken,
  openingState,
  plainDoc,
  sameDoc,
} from "./editor-state";
import { MESSAGE_KEYS } from "./catalog";
import {
  buildMessageDoc,
  docTitle,
  titleNodeFrom,
  titleText,
} from "./email-doc";

const p = (text: string): EmailDoc => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const doc = (...nodes: EmailDoc[]): EmailDoc => ({
  type: "doc",
  content: nodes,
});

const KEY = "booking_cancelled" as const;
// What the editor is given: the default text and the whole email as a document.
const DEFAULT_DOC = buildMessageDoc({
  key: KEY,
  title: "Hola {{first_name}}",
  intro: doc(p("Cuerpo")),
  outro: doc(p("Cierre")),
});
const DEFAULT = {
  subject: "Tu cita, {{first_name}}",
  preheader: "Te esperamos",
  title: "Hola {{first_name}}",
  doc: DEFAULT_DOC,
};
/** The three fields the editor holds. */
const FIELDS = {
  subject: DEFAULT.subject,
  preheader: DEFAULT.preheader,
  doc: DEFAULT_DOC,
};

describe("editableLocales", () => {
  it("every message is written in both languages", () => {
    for (const key of MESSAGE_KEYS.filter((k) => k !== "booking_reminder")) {
      expect(editableLocales(key)).toEqual(["es", "en"]);
    }
  });
  it("the reminder only ever goes out in Spanish, so only that is offered", () => {
    expect(editableLocales("booking_reminder")).toEqual(["es"]);
  });
});

describe("isLinkVariable", () => {
  it("is a link where the name ends in _url", () => {
    expect(isLinkVariable("cancel_url")).toBe(true);
    expect(isLinkVariable("consent_url")).toBe(true);
    expect(isLinkVariable("first_name")).toBe(false);
  });
});

describe("sameDoc", () => {
  it("equal documents are the same", () => {
    expect(sameDoc(doc(p("a")), doc(p("a")))).toBe(true);
  });
  it("a different word is not", () => {
    expect(sameDoc(doc(p("a")), doc(p("b")))).toBe(false);
  });
  it("key order does not matter", () => {
    const a = {
      type: "doc",
      content: [{ type: "paragraph", attrs: { x: 1, y: 2 } }],
    };
    const b = {
      content: [{ attrs: { y: 2, x: 1 }, type: "paragraph" }],
      type: "doc",
    };
    expect(sameDoc(a as EmailDoc, b as EmailDoc)).toBe(true);
  });
  it("an attribute the editor leaves null or undefined is not a change", () => {
    const a = doc({
      type: "paragraph",
      attrs: { textAlign: null },
      content: [],
    });
    const b = doc({ type: "paragraph", content: [] });
    expect(sameDoc(a, b)).toBe(true);
  });
  it("an empty marks list is not a change either", () => {
    const a = doc({
      type: "paragraph",
      content: [{ type: "text", text: "a", marks: [] }],
    });
    expect(sameDoc(a, doc(p("a")))).toBe(true);
  });
  it("the order of the paragraphs is", () => {
    expect(sameDoc(doc(p("a"), p("b")), doc(p("b"), p("a")))).toBe(false);
  });
  it("two empty bodies are the same, and nothing is not a body", () => {
    expect(sameDoc(null, doc())).toBe(true);
    expect(sameDoc(null, null)).toBe(true);
    expect(sameDoc(null, doc(p("a")))).toBe(false);
  });
});

describe("openingState", () => {
  it("with nothing saved, the editor opens on the default text", () => {
    expect(openingState(null, DEFAULT, KEY)).toEqual(FIELDS);
  });
  it("a saved field replaces the default for that field only", () => {
    const state = openingState(
      { subject: "Mío", preheader: null, title: null, doc: null },
      DEFAULT,
      KEY,
    );
    expect(state).toEqual({ ...FIELDS, subject: "Mío" });
  });
  it("a saved document in the current shape is the one the editor opens on", () => {
    const mine = doc(titleNodeFrom("Mi título"), p("Solo mío"));
    expect(
      openingState(
        { subject: null, preheader: null, title: null, doc: mine },
        DEFAULT,
        KEY,
      ).doc,
    ).toEqual(mine);
  });
  it("a row saved in the old shape opens converted: its title, its body, then the blocks, as the sender would send it", () => {
    const state = openingState(
      {
        subject: null,
        preheader: null,
        title: "Mi título",
        doc: doc(p("Solo mío")),
      },
      DEFAULT,
      KEY,
    );
    expect(titleText(docTitle(state.doc))).toBe("Mi título");
    expect((state.doc.content ?? []).map((n) => n.type)).toEqual([
      "emailTitle",
      "paragraph",
      "systemBlock",
    ]);
  });
  it("an old row with only a title opens on the default document under that title", () => {
    const state = openingState(
      { subject: null, preheader: null, title: "Otro título", doc: null },
      DEFAULT,
      KEY,
    );
    expect(titleText(docTitle(state.doc))).toBe("Otro título");
    expect(state.doc.content!.length).toBe(DEFAULT_DOC.content!.length);
  });
  it("a blank saved text is the default, not an empty subject", () => {
    expect(
      openingState(
        { subject: "  ", preheader: null, title: null, doc: null },
        DEFAULT,
        KEY,
      ).subject,
    ).toBe(DEFAULT.subject);
  });
});

describe("changedFields", () => {
  const opening = openingState(null, DEFAULT, KEY);

  it("nothing touched sends nothing: the default is never saved as content", () => {
    expect(changedFields(opening, { ...opening })).toEqual({});
  });
  it("only the field that changed is sent", () => {
    expect(changedFields(opening, { ...opening, subject: "Otro" })).toEqual({
      subject: "Otro",
    });
  });
  it("a changed title is a changed document: the title is part of it", () => {
    const retitled = {
      ...opening.doc,
      content: opening.doc.content!.map((n) =>
        n.type === "emailTitle" ? titleNodeFrom("Otro título") : n,
      ),
    };
    expect(changedFields(opening, { ...opening, doc: retitled })).toEqual({
      doc: retitled,
    });
  });
  it("moving a block is a change, and so is taking away one that can go", () => {
    const nodes = [...opening.doc.content!];
    const swapped = {
      ...opening.doc,
      content: [nodes[0]!, nodes[2]!, nodes[1]!, ...nodes.slice(3)],
    };
    expect(
      Object.keys(changedFields(opening, { ...opening, doc: swapped })),
    ).toEqual(["doc"]);
    const without = {
      ...opening.doc,
      content: nodes.filter((n) => n.type !== "systemBlock"),
    };
    expect(
      Object.keys(changedFields(opening, { ...opening, doc: without })),
    ).toEqual(["doc"]);
  });
  it("trailing spaces are not a change", () => {
    expect(
      changedFields(opening, { ...opening, subject: `${opening.subject}  ` }),
    ).toEqual({});
  });
  it("emptying a text clears it (null), so the default comes back", () => {
    expect(changedFields(opening, { ...opening, preheader: "   " })).toEqual({
      preheader: null,
    });
  });
  it("a changed body is sent whole", () => {
    const edited = doc(p("Nuevo"));
    expect(changedFields(opening, { ...opening, doc: edited })).toEqual({
      doc: edited,
    });
  });
  it("an emptied document is sent as null: empty means the default", () => {
    expect(changedFields(opening, { ...opening, doc: doc() })).toEqual({
      doc: null,
    });
    expect(changedFields(opening, { ...opening, doc: doc(p("")) })).toEqual({
      doc: null,
    });
  });
  it("a body the editor re-emitted with null attributes is not a change", () => {
    const again = {
      ...opening.doc,
      content: opening.doc.content!.map((node) =>
        node.type === "paragraph"
          ? { ...node, attrs: { textAlign: null } }
          : node,
      ),
    };
    expect(changedFields(opening, { ...opening, doc: again })).toEqual({});
  });
});

describe("docErrorLines", () => {
  it("names the block of the body a problem is in, counting from one", () => {
    expect(
      docErrorLines({ "doc.content.2.attrs.url": "linkNotAllowed" }),
    ).toEqual([{ key: "linkNotAllowed", block: 3 }]);
  });
  it("a problem nested in a block is still that block", () => {
    expect(
      docErrorLines({
        "doc.content.0.content.1.marks.0.attrs.href": "linkNotAllowed",
      }),
    ).toEqual([{ key: "linkNotAllowed", block: 1 }]);
  });
  it("a problem with the document as a whole has no block", () => {
    expect(docErrorLines({ doc: "docTooLarge" })).toEqual([
      { key: "docTooLarge", block: null },
    ]);
  });
  it("leaves the other fields to their own inputs", () => {
    expect(
      docErrorLines({ subject: "unknownVariable", title: "titleTooLong" }),
    ).toEqual([]);
  });
  it("says each kind of problem in a block once", () => {
    expect(
      docErrorLines({
        "doc.content.1.attrs.url": "linkNotAllowed",
        "doc.content.1.content.0.marks.0.attrs.href": "linkNotAllowed",
        "doc.content.1.type": "blockNotAllowed",
      }),
    ).toEqual([
      { key: "linkNotAllowed", block: 2 },
      { key: "blockNotAllowed", block: 2 },
    ]);
  });
});

describe("insertAtSelection", () => {
  it("puts the variable at the caret", () => {
    expect(insertAtSelection("Hola ", 5, 5, "{{first_name}}")).toEqual({
      value: "Hola {{first_name}}",
      caret: 19,
    });
  });
  it("replaces what is selected", () => {
    expect(insertAtSelection("Hola XXX!", 5, 8, "{{first_name}}").value).toBe(
      "Hola {{first_name}}!",
    );
  });
  it("with no selection it goes at the end", () => {
    expect(insertAtSelection("Hola", null, null, "{{a}}").value).toBe(
      "Hola{{a}}",
    );
  });
  it("a selection past the text is the end of it", () => {
    expect(insertAtSelection("Hi", 99, 99, "{{a}}").value).toBe("Hi{{a}}");
  });
  it("the token is double braces around the name", () => {
    expect(variableToken("service")).toBe("{{service}}");
  });
});

describe("linkButtonNode", () => {
  it("is a button whose address is the variable", () => {
    const node = linkButtonNode("cancel_url", "es");
    expect(node.type).toBe("button");
    expect(node.attrs).toMatchObject({
      url: "cancel_url",
      isUrlVariable: true,
      text: "Cancelar mi cita",
    });
  });
  it("is worded in the language of the message", () => {
    expect(linkButtonNode("consent_url", "en").attrs?.text).toBe(
      "Sign the consent form",
    );
  });
});

describe("flushCurrent", () => {
  const fields = { ...DEFAULT };
  const typed = doc(p("Cuerpo"), p("Cierre"), p("Lo último que escribí"));

  it("with nothing pending the state is already right", () => {
    const pending = { timer: null };
    expect(flushCurrent(fields, pending, () => typed)).toBe(fields);
  });

  it("with an update pending it takes what the editor holds right now", () => {
    const timer = setTimeout(() => {}, 10_000);
    const cleared: unknown[] = [];
    const pending = { timer };
    const out = flushCurrent(
      fields,
      pending,
      () => typed,
      (t) => {
        cleared.push(t);
      },
    );
    clearTimeout(timer);
    expect(out.doc).toBe(typed);
    expect(out.subject).toBe(fields.subject);
    // The update that was about to say the same thing is cancelled.
    expect(cleared).toEqual([timer]);
    expect(pending.timer).toBeNull();
  });

  it("a second flush finds nothing pending: pressing twice does not redo it", () => {
    const timer = setTimeout(() => {}, 10_000);
    const pending = { timer };
    const first = flushCurrent(
      fields,
      pending,
      () => typed,
      () => {},
    );
    clearTimeout(timer);
    expect(
      flushCurrent(
        first,
        pending,
        () => typed,
        () => {},
      ),
    ).toBe(first);
  });

  it("an editor that is not there leaves the state and the timer alone", () => {
    const timer = setTimeout(() => {}, 10_000);
    const pending = { timer };
    expect(
      flushCurrent(
        fields,
        pending,
        () => null,
        () => {},
      ),
    ).toBe(fields);
    expect(pending.timer).toBe(timer);
    clearTimeout(timer);
  });

  it("what it returns shows as a change, which is what the save and the close read", () => {
    const timer = setTimeout(() => {}, 10_000);
    const pending = { timer };
    const out = flushCurrent(
      fields,
      pending,
      () => typed,
      () => {},
    );
    clearTimeout(timer);
    expect(changedFields(fields, out)).toEqual({ doc: typed });
    expect(changedFields(fields, fields)).toEqual({});
  });
});

describe("docErrorLines for the whole email", () => {
  it("a block the message cannot do without is named by its kind, not by a position", () => {
    expect(
      docErrorLines({ "doc.blocks.cancel_link": "blockRequired" }),
    ).toEqual([
      { key: "blockRequired", block: null, blockKind: "cancel_link" },
    ]);
  });
  it("the title has a line of its own, and a block of the body keeps its number", () => {
    expect(
      docErrorLines({
        "doc.title": "titleOne",
        "doc.content.3": "blockRepeated",
      }),
    ).toEqual([
      { key: "titleOne", block: null },
      { key: "blockRepeated", block: 4 },
    ]);
  });
});

describe("plainDoc", () => {
  it("turns attributes with no prototype (the editor's) into plain objects, which a Server Action carries", () => {
    const attrs = Object.create(null) as Record<string, unknown>;
    attrs.kind = "cancel_link";
    const out = plainDoc({
      type: "doc",
      content: [{ type: "systemBlock", attrs }],
    });
    const copy = out.content![0]!.attrs!;
    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
    expect(copy).toEqual({ kind: "cancel_link" });
  });
  it("changes nothing else about the document", () => {
    const d = doc(p("a"), {
      type: "variable",
      attrs: { id: "first_name" },
    } as EmailDoc);
    expect(plainDoc(d)).toEqual(d);
    expect(sameDoc(plainDoc(d), d)).toBe(true);
  });
});
