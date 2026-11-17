import { describe, expect, it } from "bun:test";
import type { EmailDoc } from "@/types/campaign";
import {
  changedFields,
  docErrorLines,
  editableLocales,
  insertAtSelection,
  isLinkVariable,
  linkButtonNode,
  variableToken,
  openingState,
  sameDoc,
} from "./editor-state";
import { MESSAGE_KEYS } from "./catalog";

const p = (text: string): EmailDoc => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const doc = (...nodes: EmailDoc[]): EmailDoc => ({
  type: "doc",
  content: nodes,
});

const DEFAULT = {
  subject: "Tu cita, {{first_name}}",
  preheader: "Te esperamos",
  title: "Hola {{first_name}}",
  doc: doc(p("Cuerpo"), p("Cierre")),
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
    expect(openingState(null, DEFAULT)).toEqual(DEFAULT);
  });
  it("a saved field replaces the default for that field only", () => {
    const state = openingState(
      { subject: "Mío", preheader: null, title: null, doc: null },
      DEFAULT,
    );
    expect(state).toEqual({ ...DEFAULT, subject: "Mío" });
  });
  it("a saved body replaces the whole default one", () => {
    const mine = doc(p("Solo mío"));
    expect(
      openingState(
        { subject: null, preheader: null, title: null, doc: mine },
        DEFAULT,
      ).doc,
    ).toEqual(mine);
  });
  it("a blank saved text is the default, not an empty subject", () => {
    expect(
      openingState(
        { subject: "  ", preheader: null, title: null, doc: null },
        DEFAULT,
      ).subject,
    ).toBe(DEFAULT.subject);
  });
});

describe("changedFields", () => {
  const opening = openingState(null, DEFAULT);

  it("nothing touched sends nothing: the default is never saved as content", () => {
    expect(changedFields(opening, { ...opening })).toEqual({});
  });
  it("only the field that changed is sent", () => {
    expect(changedFields(opening, { ...opening, title: "Otro" })).toEqual({
      title: "Otro",
    });
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
  it("an emptied body is sent as null: empty means the default text", () => {
    expect(changedFields(opening, { ...opening, doc: doc() })).toEqual({
      doc: null,
    });
    expect(changedFields(opening, { ...opening, doc: doc(p("")) })).toEqual({
      doc: null,
    });
  });
  it("a body the editor re-emitted with null attributes is not a change", () => {
    const again = doc(
      {
        type: "paragraph",
        attrs: { textAlign: null },
        content: [{ type: "text", text: "Cuerpo" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: null },
        content: [{ type: "text", text: "Cierre" }],
      },
    );
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
