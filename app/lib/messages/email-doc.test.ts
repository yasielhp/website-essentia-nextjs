import { describe, expect, test } from "bun:test";
import type { EmailDoc } from "@/types/campaign";
import {
  FIXED_BLOCK_INFO,
  MESSAGE_CATALOG,
  MESSAGE_KEYS,
  isRequiredBlock,
  requiredBlocks,
} from "./catalog";
import {
  BLOCK_NODE,
  TITLE_NODE,
  blockNode,
  buildMessageDoc,
  convertOldShape,
  docTitle,
  insertIndexFor,
  missingBlocks,
  isMessageDoc,
  layoutOf,
  repairForSending,
  structureProblems,
  titleNodeFrom,
  titleText,
  withoutSpecialNodes,
} from "./email-doc";

const p = (text: string): EmailDoc => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const doc = (...content: EmailDoc[]): EmailDoc => ({ type: "doc", content });
const kinds = (d: EmailDoc) =>
  (d.content ?? []).map((n) =>
    n.type === BLOCK_NODE ? `block:${n.attrs?.kind}` : n.type,
  );

describe("which blocks can be taken out", () => {
  test("the ones that do a job cannot; the ones that only inform can", () => {
    expect(isRequiredBlock("cancel_link")).toBe(true);
    expect(isRequiredBlock("consent_button")).toBe(true);
    expect(isRequiredBlock("payment_note")).toBe(true);
    expect(isRequiredBlock("bonus_card")).toBe(true);
    expect(isRequiredBlock("details_card")).toBe(false);
    expect(isRequiredBlock("location")).toBe(false);
    expect(isRequiredBlock("calendar_button")).toBe(false);
  });
  test("every block the catalogue uses says it", () => {
    for (const key of MESSAGE_KEYS) {
      for (const block of MESSAGE_CATALOG[key].fixed) {
        expect(FIXED_BLOCK_INFO[block]).toBeDefined();
      }
    }
  });
  test("what each message cannot do without", () => {
    expect(requiredBlocks("booking_received")).toEqual([
      "payment_note",
      "cancel_link",
    ]);
    expect(requiredBlocks("booking_confirmed")).toEqual([
      "consent_button",
      "cancel_link",
    ]);
    expect(requiredBlocks("booking_paid")).toEqual([
      "payment_note",
      "consent_button",
    ]);
    expect(requiredBlocks("booking_rescheduled")).toEqual(["cancel_link"]);
    expect(requiredBlocks("booking_cancelled")).toEqual([]);
    expect(requiredBlocks("booking_reminder")).toEqual(["cancel_link"]);
    expect(requiredBlocks("consent_request")).toEqual(["consent_button"]);
    expect(requiredBlocks("bonus_purchase")).toEqual(["bonus_card"]);
  });
});

describe("the layout every message has always had", () => {
  test("blocks before and after the closing sentence together are the catalogue's blocks, in order", () => {
    for (const key of MESSAGE_KEYS) {
      const { before, after } = layoutOf(key);
      expect([...before, ...after]).toEqual(MESSAGE_CATALOG[key].fixed);
    }
  });
  test("only the request-received email prints a block after its closing sentence", () => {
    for (const key of MESSAGE_KEYS) {
      expect(layoutOf(key).after).toEqual(
        key === "booking_received" ? ["cancel_link"] : [],
      );
    }
  });
});

describe("the title", () => {
  test("is text and variable nodes, the ones the editor makes", () => {
    const t = titleNodeFrom("Gracias, {{first_name}}. Hasta pronto.");
    expect(t).toEqual({
      type: TITLE_NODE,
      content: [
        { type: "text", text: "Gracias, " },
        { type: "variable", attrs: { id: "first_name" } },
        { type: "text", text: ". Hasta pronto." },
      ],
    });
  });
  test("reads back as text with its tokens", () => {
    expect(titleText(titleNodeFrom("Hola {{ first_name }}!"))).toBe(
      "Hola {{first_name}}!",
    );
    expect(titleText(undefined)).toBe("");
  });
});

describe("the document a message opens with", () => {
  const intro = doc(p("Uno"), p("Dos"));
  test("title, text, then the blocks before the closing sentence, the closing sentence, and the blocks after", () => {
    const d = buildMessageDoc({
      key: "booking_received",
      title: "Hola",
      intro,
      outro: doc(p("Cierre")),
    });
    expect(kinds(d)).toEqual([
      TITLE_NODE,
      "paragraph",
      "paragraph",
      "block:details_card",
      "block:payment_note",
      "paragraph",
      "block:cancel_link",
    ]);
  });
  test("a message with no closing sentence has none", () => {
    const d = buildMessageDoc({
      key: "consent_request",
      title: "Hola",
      intro,
      outro: null,
    });
    expect(kinds(d)).toEqual([
      TITLE_NODE,
      "paragraph",
      "paragraph",
      "block:consent_button",
    ]);
  });
  test("every message's default document is in order, with every one of its blocks once", () => {
    for (const key of MESSAGE_KEYS) {
      const d = buildMessageDoc({ key, title: "T", intro, outro: doc(p("C")) });
      expect(structureProblems(d, key)).toEqual([]);
      const blocks = (d.content ?? [])
        .filter((n) => n.type === BLOCK_NODE)
        .map((n) => n.attrs?.kind);
      expect(blocks).toEqual([...MESSAGE_CATALOG[key].fixed]);
    }
  });
});

describe("a row saved before the title and the blocks were in the document", () => {
  const defaults = {
    title: "Título por defecto",
    doc: buildMessageDoc({
      key: "booking_confirmed",
      title: "Título por defecto",
      intro: doc(p("Intro")),
      outro: doc(p("Cierre")),
    }),
  };
  test("with its own body: its title, its body, then the blocks as always", () => {
    const out = convertOldShape(
      { title: "Mi título", doc: doc(p("Mi texto")) },
      "booking_confirmed",
      defaults,
    );
    expect(kinds(out)).toEqual([
      TITLE_NODE,
      "paragraph",
      "block:details_card",
      "block:location",
      "block:calendar_button",
      "block:consent_button",
      "block:cancel_link",
    ]);
    expect(titleText(docTitle(out))).toBe("Mi título");
  });
  test("with its own body and no title of its own, the default title", () => {
    const out = convertOldShape(
      { title: null, doc: doc(p("x")) },
      "booking_confirmed",
      defaults,
    );
    expect(titleText(docTitle(out))).toBe("Título por defecto");
  });
  test("with no body of its own: the default document, under its title when it has one", () => {
    const out = convertOldShape(
      { title: "Otro", doc: null },
      "booking_confirmed",
      defaults,
    );
    expect(kinds(out)).toEqual(kinds(defaults.doc));
    expect(titleText(docTitle(out))).toBe("Otro");
    expect(
      convertOldShape(
        { title: null, doc: null },
        "booking_confirmed",
        defaults,
      ),
    ).toBe(defaults.doc);
  });
  test("a body that is not a document counts as none", () => {
    const out = convertOldShape(
      { title: null, doc: { type: "doc" } },
      "booking_confirmed",
      defaults,
    );
    expect(out).toBe(defaults.doc);
  });
  test("a document that is already in the new shape is left as it is", () => {
    const saved = doc(titleNodeFrom("x"), blockNode("cancel_link"));
    expect(
      convertOldShape(
        { title: "ignored", doc: saved },
        "booking_confirmed",
        defaults,
      ),
    ).toBe(saved);
    expect(isMessageDoc(saved)).toBe(true);
    expect(isMessageDoc(doc(p("x")))).toBe(false);
  });
  test("the conversion is a document that passes the structure check", () => {
    const out = convertOldShape(
      { title: "T", doc: doc(p("x")) },
      "booking_confirmed",
      defaults,
    );
    expect(structureProblems(out, "booking_confirmed")).toEqual([]);
  });
});

describe("structureProblems: what saving refuses", () => {
  const good = () =>
    doc(
      titleNodeFrom("Hola"),
      p("x"),
      blockNode("details_card"),
      blockNode("cancel_link"),
    );

  test("a good document has none", () => {
    expect(structureProblems(good(), "booking_rescheduled")).toEqual([]);
  });
  test("no title, or two", () => {
    const none = doc(p("x"), blockNode("cancel_link"));
    expect(structureProblems(none, "booking_rescheduled")).toContainEqual({
      kind: "titleOne",
      path: "",
    });
    const two = doc(
      titleNodeFrom("a"),
      titleNodeFrom("b"),
      blockNode("cancel_link"),
    );
    expect(structureProblems(two, "booking_rescheduled")).toContainEqual({
      kind: "titleOne",
      path: "",
    });
  });
  test("a required block that is missing is named", () => {
    const d = doc(titleNodeFrom("Hola"), p("x"));
    expect(structureProblems(d, "booking_rescheduled")).toEqual([
      { kind: "blockRequired", path: "", block: "cancel_link" },
    ]);
    expect(structureProblems(d, "booking_cancelled")).toEqual([]);
  });
  test("a block that is not removable is missing for every message that needs it", () => {
    for (const key of MESSAGE_KEYS) {
      const d = doc(titleNodeFrom("Hola"));
      const missing = structureProblems(d, key)
        .filter((q) => q.kind === "blockRequired")
        .map((q) => (q as { block: string }).block);
      expect(missing).toEqual(requiredBlocks(key));
    }
  });
  test("a block that can be removed may be missing", () => {
    const d = doc(titleNodeFrom("Hola"), blockNode("cancel_link"));
    expect(structureProblems(d, "booking_rescheduled")).toEqual([]);
  });
  test("a block of another message, an unknown one and one with content or other attributes are refused", () => {
    const other = doc(
      titleNodeFrom("H"),
      blockNode("cancel_link"),
      blockNode("bonus_card"),
    );
    expect(structureProblems(other, "booking_rescheduled")).toContainEqual({
      kind: "blockNotAllowed",
      path: "content[2]",
      node: BLOCK_NODE,
    });
    const unknown = doc(titleNodeFrom("H"), blockNode("cancel_link"), {
      type: BLOCK_NODE,
      attrs: { kind: "constructor" },
    });
    expect(
      structureProblems(unknown, "booking_rescheduled").some(
        (q) => q.kind === "blockNotAllowed",
      ),
    ).toBe(true);
    const noKind = doc(titleNodeFrom("H"), blockNode("cancel_link"), {
      type: BLOCK_NODE,
    });
    expect(
      structureProblems(noKind, "booking_rescheduled").some(
        (q) => q.kind === "blockNotAllowed",
      ),
    ).toBe(true);
    const content = doc(titleNodeFrom("H"), blockNode("cancel_link"), {
      type: BLOCK_NODE,
      attrs: { kind: "details_card" },
      content: [p("x")],
    });
    expect(
      structureProblems(content, "booking_rescheduled").some(
        (q) => q.kind === "blockNotAllowed",
      ),
    ).toBe(true);
    const extra = doc(titleNodeFrom("H"), blockNode("cancel_link"), {
      type: BLOCK_NODE,
      attrs: { kind: "details_card", onclick: "x" },
    });
    expect(
      structureProblems(extra, "booking_rescheduled").some(
        (q) => q.kind === "blockNotAllowed",
      ),
    ).toBe(true);
  });
  test("a block twice is refused at the second one", () => {
    const d = doc(
      titleNodeFrom("H"),
      blockNode("cancel_link"),
      blockNode("cancel_link"),
    );
    expect(structureProblems(d, "booking_rescheduled")).toEqual([
      { kind: "blockRepeated", path: "content[2]", block: "cancel_link" },
    ]);
  });
  test("a title holds text and the variables the message offers, and nothing else", () => {
    const withLink: EmailDoc = {
      type: TITLE_NODE,
      content: [
        {
          type: "text",
          text: "x",
          marks: [{ type: "link", attrs: { href: "https://e.com" } }],
        },
      ],
    };
    expect(
      structureProblems(
        doc(withLink, blockNode("cancel_link")),
        "booking_rescheduled",
      ),
    ).toContainEqual({
      kind: "blockNotAllowed",
      path: "content[0].content[0]",
      node: "text",
    });
    const image: EmailDoc = {
      type: TITLE_NODE,
      content: [{ type: "image", attrs: { src: "https://x/y.png" } }],
    };
    expect(
      structureProblems(
        doc(image, blockNode("cancel_link")),
        "booking_rescheduled",
      ).some((q) => q.kind === "blockNotAllowed"),
    ).toBe(true);
    const address: EmailDoc = {
      type: TITLE_NODE,
      content: [{ type: "variable", attrs: { id: "cancel_url" } }],
    };
    expect(
      structureProblems(
        doc(address, blockNode("cancel_link")),
        "booking_rescheduled",
      ).some((q) => q.kind === "blockNotAllowed"),
    ).toBe(true);
    const nested: EmailDoc = {
      type: TITLE_NODE,
      content: [{ type: "hardBreak" }],
    };
    expect(
      structureProblems(
        doc(nested, blockNode("cancel_link")),
        "booking_rescheduled",
      ).some((q) => q.kind === "blockNotAllowed"),
    ).toBe(true);
  });
  test("a variable the message does not offer is not this check's to name: the text check names it", () => {
    const t: EmailDoc = {
      type: TITLE_NODE,
      content: [{ type: "variable", attrs: { id: "nope" } }],
    };
    expect(
      structureProblems(
        doc(t, blockNode("cancel_link")),
        "booking_rescheduled",
      ),
    ).toEqual([]);
  });
});

describe("withoutSpecialNodes", () => {
  test("keeps every index and leaves the editor's own nodes and anything nested alone", () => {
    const nested: EmailDoc = {
      type: "section",
      content: [blockNode("cancel_link")],
    };
    const d = doc(titleNodeFrom("H"), p("x"), blockNode("cancel_link"), nested);
    const out = withoutSpecialNodes(d);
    expect(out.content!.map((n) => n.type)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
      "section",
    ]);
    // The nested one is still there, for the validator to refuse.
    expect(out.content![3]!.content![0]!.type).toBe(BLOCK_NODE);
  });
});

describe("repairForSending: an email never goes out without what it needs", () => {
  test("a good document is left as it is", () => {
    const d = doc(
      titleNodeFrom("H"),
      p("x"),
      blockNode("details_card"),
      blockNode("cancel_link"),
    );
    expect(repairForSending(d, "booking_rescheduled", "Def")).toEqual(d);
  });
  test("a missing required block is added at the end, in the order the message has its blocks", () => {
    const d = doc(titleNodeFrom("H"), p("x"));
    expect(kinds(repairForSending(d, "booking_confirmed", "Def"))).toEqual([
      TITLE_NODE,
      "paragraph",
      "block:consent_button",
      "block:cancel_link",
    ]);
  });
  test("a removable block that is missing stays missing", () => {
    const d = doc(titleNodeFrom("H"), blockNode("cancel_link"));
    expect(kinds(repairForSending(d, "booking_rescheduled", "Def"))).toEqual([
      TITLE_NODE,
      "block:cancel_link",
    ]);
  });
  test("with no title, the default one goes first; with two, only the first stays", () => {
    const none = repairForSending(
      doc(p("x"), blockNode("cancel_link")),
      "booking_rescheduled",
      "Hola {{first_name}}",
    );
    expect(kinds(none)[0]).toBe(TITLE_NODE);
    expect(titleText(docTitle(none))).toBe("Hola {{first_name}}");
    const two = repairForSending(
      doc(
        titleNodeFrom("a"),
        p("x"),
        titleNodeFrom("b"),
        blockNode("cancel_link"),
      ),
      "booking_rescheduled",
      "Def",
    );
    expect(kinds(two).filter((k) => k === TITLE_NODE)).toHaveLength(1);
    expect(titleText(docTitle(two))).toBe("a");
  });
  test("a block of another message, a repeated one and one with content are dropped", () => {
    const d = doc(
      titleNodeFrom("H"),
      blockNode("bonus_card"),
      blockNode("cancel_link"),
      blockNode("cancel_link"),
      {
        type: BLOCK_NODE,
        attrs: { kind: "details_card" },
        content: [p("hack")],
      },
    );
    expect(kinds(repairForSending(d, "booking_rescheduled", "Def"))).toEqual([
      TITLE_NODE,
      "block:cancel_link",
    ]);
  });
  test("a block keeps only its kind", () => {
    const d = doc(titleNodeFrom("H"), {
      type: BLOCK_NODE,
      attrs: { kind: "cancel_link", onclick: "x" },
    });
    expect(
      repairForSending(d, "booking_rescheduled", "Def").content![1],
    ).toEqual({ type: BLOCK_NODE, attrs: { kind: "cancel_link" } });
  });
  test("a title keeps text and the variables the message offers, and nothing more", () => {
    const t: EmailDoc = {
      type: TITLE_NODE,
      content: [
        { type: "text", text: "Hola ", marks: [{ type: "bold" }] },
        { type: "variable", attrs: { id: "first_name" } },
        { type: "variable", attrs: { id: "cancel_url" } },
        { type: "variable", attrs: { id: "nope" } },
        { type: "image", attrs: { src: "https://x/y.png" } },
      ],
    };
    const out = repairForSending(
      doc(t, blockNode("cancel_link")),
      "booking_rescheduled",
      "Def",
    );
    expect(out.content![0]).toEqual({
      type: TITLE_NODE,
      content: [
        { type: "text", text: "Hola " },
        { type: "variable", attrs: { id: "first_name" } },
      ],
    });
  });
  test("an odd document does not throw", () => {
    expect(() =>
      repairForSending({ type: "doc" }, "booking_rescheduled", "Def"),
    ).not.toThrow();
    expect(() =>
      repairForSending(
        { type: "doc", content: [null as never, 4 as never] },
        "booking_rescheduled",
        "Def",
      ),
    ).not.toThrow();
  });
});

describe("putting a block back", () => {
  test("it joins the blocks, right after the last one that comes before it in the message's order", () => {
    // confirmed: details, location, calendar, consent, cancel
    expect(
      insertIndexFor(
        [TITLE_NODE, null, "details_card", "consent_button"],
        "location",
        "booking_confirmed",
      ),
    ).toBe(3);
    expect(
      insertIndexFor(
        [TITLE_NODE, null, "details_card"],
        "cancel_link",
        "booking_confirmed",
      ),
    ).toBe(3);
    // The closing sentence after the blocks stays after them.
    expect(
      insertIndexFor(
        [TITLE_NODE, "details_card", "calendar_button", null],
        "cancel_link",
        "booking_rescheduled",
      ),
    ).toBe(3);
  });
  test("with none before it, ahead of the first one after it; with none at all, at the end", () => {
    expect(
      insertIndexFor(
        [TITLE_NODE, "location"],
        "details_card",
        "booking_confirmed",
      ),
    ).toBe(1);
    expect(insertIndexFor([], "details_card", "booking_confirmed")).toBe(0);
    expect(
      insertIndexFor(
        [TITLE_NODE, null, null],
        "details_card",
        "booking_confirmed",
      ),
    ).toBe(3);
  });
  test("a text between blocks does not move it: it follows the block before it", () => {
    expect(
      insertIndexFor(
        ["details_card", null, null, "cancel_link"],
        "calendar_button",
        "booking_rescheduled",
      ),
    ).toBe(1);
  });
  test("the blocks that can be put back are the ones the document lacks, in the message's order", () => {
    const d = doc(
      titleNodeFrom("H"),
      blockNode("details_card"),
      blockNode("cancel_link"),
    );
    expect(missingBlocks(d, "booking_confirmed")).toEqual([
      "location",
      "calendar_button",
      "consent_button",
    ]);
    expect(missingBlocks(doc(titleNodeFrom("H")), "booking_cancelled")).toEqual(
      ["details_card"],
    );
    expect(
      missingBlocks(
        buildMessageDoc({
          key: "booking_cancelled",
          title: "T",
          intro: doc(),
          outro: null,
        }),
        "booking_cancelled",
      ),
    ).toEqual([]);
  });
});
