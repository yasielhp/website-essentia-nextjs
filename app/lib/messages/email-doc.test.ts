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
  KICKER_NODE,
  TITLE_NODE,
  blockNode,
  buildMessageDoc,
  convertOldShape,
  docKicker,
  docTitle,
  insertIndexFor,
  kickerIsEmpty,
  kickerNodeFrom,
  missingBlocks,
  isMessageDoc,
  layoutOf,
  repairForSending,
  structureProblems,
  titleNodeFrom,
  titleText,
  withKickerSlot,
  withoutEmptyKicker,
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

describe("the title cannot be empty, and has no attributes", () => {
  const withTitle = (t: EmailDoc) => doc(t, blockNode("cancel_link"));
  test("no content, only spaces, or only empty text is refused; a variable is a title", () => {
    for (const t of [
      { type: TITLE_NODE },
      { type: TITLE_NODE, content: [] },
      { type: TITLE_NODE, content: [{ type: "text", text: "   " }] },
      { type: TITLE_NODE, content: [{ type: "text", text: "" }] },
    ] as EmailDoc[]) {
      expect(structureProblems(withTitle(t), "booking_rescheduled")).toEqual([
        { kind: "titleEmpty", path: "" },
      ]);
    }
    expect(
      structureProblems(
        withTitle(titleNodeFrom("{{first_name}}")),
        "booking_rescheduled",
      ),
    ).toEqual([]);
    expect(
      structureProblems(
        withTitle(titleNodeFrom(" Hola ")),
        "booking_rescheduled",
      ),
    ).toEqual([]);
  });
  test("attributes on the title are refused, as on a block", () => {
    const t = { ...titleNodeFrom("Hola"), attrs: { onclick: "x", style: "x" } };
    expect(structureProblems(withTitle(t), "booking_rescheduled")).toEqual([
      { kind: "blockNotAllowed", path: "content[0]", node: TITLE_NODE },
    ]);
    // An empty attribute object is nothing.
    expect(
      structureProblems(
        withTitle({ ...titleNodeFrom("Hola"), attrs: {} }),
        "booking_rescheduled",
      ),
    ).toEqual([]);
  });
});

// ── the kicker: the small line in capitals above the title ──────────────────

describe("the kicker", () => {
  const kicker = (text: string) => kickerNodeFrom(text);
  const good = (key: (typeof MESSAGE_KEYS)[number]) =>
    doc(
      kicker("Reserva confirmada"),
      titleNodeFrom("Hola, {{first_name}}"),
      p("Texto."),
      ...requiredBlocks(key).map(blockNode),
    );

  test("is text and variable nodes, like the title, and reads back as text with its tokens", () => {
    const node = kicker("Reserva de {{service}}");
    expect(node).toEqual({
      type: KICKER_NODE,
      content: [
        { type: "text", text: "Reserva de " },
        { type: "variable", attrs: { id: "service" } },
      ],
    });
    expect(titleText(node)).toBe("Reserva de {{service}}");
  });

  test("empty is allowed: it says nothing and is not an error", () => {
    for (const empty of [
      { type: KICKER_NODE },
      { type: KICKER_NODE, content: [] },
      { type: KICKER_NODE, content: [{ type: "text", text: "  " }] },
    ] as EmailDoc[]) {
      expect(kickerIsEmpty(empty)).toBe(true);
      const d = doc(
        empty,
        titleNodeFrom("Hola"),
        ...requiredBlocks("booking_rescheduled").map(blockNode),
      );
      expect(structureProblems(d, "booking_rescheduled")).toEqual([]);
    }
    expect(kickerIsEmpty(kicker("x"))).toBe(false);
    expect(kickerIsEmpty(kicker("{{service}}"))).toBe(false);
  });

  test("a good document, with the kicker first, has no problem; so has one with no kicker", () => {
    expect(
      structureProblems(good("booking_rescheduled"), "booking_rescheduled"),
    ).toEqual([]);
    expect(
      structureProblems(
        doc(
          titleNodeFrom("Hola"),
          ...requiredBlocks("booking_rescheduled").map(blockNode),
        ),
        "booking_rescheduled",
      ),
    ).toEqual([]);
  });

  test("two kickers are refused at the second", () => {
    const d = doc(
      kicker("A"),
      kicker("B"),
      titleNodeFrom("Hola"),
      blockNode("cancel_link"),
    );
    expect(structureProblems(d, "booking_rescheduled")).toEqual([
      { kind: "kickerOne", path: "" },
    ]);
  });

  test("a kicker that is not first (after the title, or after any text) is refused", () => {
    const afterTitle = doc(
      titleNodeFrom("Hola"),
      kicker("A"),
      blockNode("cancel_link"),
    );
    expect(structureProblems(afterTitle, "booking_rescheduled")).toEqual([
      { kind: "kickerMisplaced", path: "content[1]" },
    ]);
    const afterText = doc(
      p("x"),
      kicker("A"),
      titleNodeFrom("Hola"),
      blockNode("cancel_link"),
    );
    expect(structureProblems(afterText, "booking_rescheduled")).toEqual([
      { kind: "kickerMisplaced", path: "content[1]" },
    ]);
  });

  test("attributes, a mark, a link variable or anything but text and variables inside are refused", () => {
    const d = (node: EmailDoc) =>
      doc(node, titleNodeFrom("Hola"), blockNode("cancel_link"));
    expect(
      structureProblems(
        d({ ...kicker("A"), attrs: { onclick: "x" } }),
        "booking_rescheduled",
      ),
    ).toEqual([
      { kind: "blockNotAllowed", path: "content[0]", node: KICKER_NODE },
    ]);
    // An empty attribute object is nothing.
    expect(
      structureProblems(
        d({ ...kicker("A"), attrs: {} }),
        "booking_rescheduled",
      ),
    ).toEqual([]);
    for (const child of [
      { type: "htmlCodeBlock", attrs: { html: "<script>" } },
      { type: "paragraph", content: [{ type: "text", text: "x" }] },
      {
        type: "text",
        text: "x",
        marks: [{ type: "link", attrs: { href: "https://a.b" } }],
      },
      { type: "variable", attrs: { id: "cancel_url" } },
    ] as EmailDoc[]) {
      expect(
        structureProblems(
          d({ type: KICKER_NODE, content: [child] }),
          "booking_rescheduled",
        ).map((x) => x.kind),
      ).toEqual(["blockNotAllowed"]);
    }
  });

  test("a variable the message does not offer is the text check's to name, not this one's", () => {
    const d = doc(
      kicker("{{expires_on}}"),
      titleNodeFrom("Hola"),
      blockNode("cancel_link"),
    );
    expect(
      structureProblems(d, "booking_rescheduled").filter(
        (x) => x.kind === "blockNotAllowed",
      ),
    ).toEqual([]);
  });

  test("withoutSpecialNodes sets it aside like the title, keeping the indices", () => {
    const d = doc(kicker("A"), titleNodeFrom("B"), p("c"));
    expect(withoutSpecialNodes(d).content!.map((n) => n.type)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    // Nested, it is not set aside: the editor's own check refuses it.
    const nested = doc({ type: "blockquote", content: [kicker("A")] });
    expect(withoutSpecialNodes(nested).content![0]!.content![0]!.type).toBe(
      KICKER_NODE,
    );
  });

  test("the default document of a message with a kicker has it first; one without has none", () => {
    const built = buildMessageDoc({
      key: "booking_confirmed",
      kicker: "Reserva confirmada",
      title: "Hola",
      intro: doc(p("a")),
      outro: null,
    });
    expect(kinds(built)[0]).toBe(KICKER_NODE);
    expect(kinds(built)[1]).toBe(TITLE_NODE);
    const none = buildMessageDoc({
      key: "consent_request",
      kicker: null,
      title: "Hola",
      intro: doc(p("a")),
      outro: null,
    });
    expect(kinds(none)[0]).toBe(TITLE_NODE);
    expect(docKicker(none)).toBeUndefined();
  });
});

describe("repairForSending with a kicker", () => {
  const fix = (d: EmailDoc, key = "booking_rescheduled" as const) =>
    repairForSending(d, key, "Título");
  const need = requiredBlocks("booking_rescheduled").map(blockNode);

  test("a kicker in its place is left as it is", () => {
    const d = doc(kickerNodeFrom("A"), titleNodeFrom("B"), ...need);
    expect(fix(d)).toEqual(d);
  });

  test("one after the title is moved up, not lost", () => {
    const d = doc(titleNodeFrom("B"), kickerNodeFrom("A"), p("x"), ...need);
    const out = fix(d);
    expect(kinds(out).slice(0, 3)).toEqual([
      KICKER_NODE,
      TITLE_NODE,
      "paragraph",
    ]);
    expect(titleText(docKicker(out))).toBe("A");
  });

  test("with two, only the first stays; with none, none is added", () => {
    const two = fix(
      doc(
        kickerNodeFrom("A"),
        kickerNodeFrom("B"),
        titleNodeFrom("T"),
        ...need,
      ),
    );
    expect(kinds(two).filter((k) => k === KICKER_NODE)).toHaveLength(1);
    expect(titleText(docKicker(two))).toBe("A");
    expect(docKicker(fix(doc(titleNodeFrom("T"), ...need)))).toBeUndefined();
  });

  test("it keeps text and the variables the message offers, and nothing more", () => {
    const out = fix(
      doc(
        {
          type: KICKER_NODE,
          attrs: { onclick: "x" },
          content: [
            { type: "text", text: "A", marks: [{ type: "bold" }] },
            { type: "variable", attrs: { id: "service" } },
            { type: "variable", attrs: { id: "cancel_url" } },
            { type: "variable", attrs: { id: "nope" } },
            { type: "htmlCodeBlock", attrs: { html: "<b>" } },
          ],
        },
        titleNodeFrom("T"),
        ...need,
      ),
    );
    expect(docKicker(out)).toEqual({
      type: KICKER_NODE,
      content: [
        { type: "text", text: "A" },
        { type: "variable", attrs: { id: "service" } },
      ],
    });
  });

  test("a kicker nested inside something else is not a kicker: it stays where it is for the editor's check to drop", () => {
    const d = doc(
      { type: "blockquote", content: [kickerNodeFrom("A")] },
      titleNodeFrom("T"),
      ...need,
    );
    expect(docKicker(fix(d))).toBeUndefined();
  });
});

describe("the slot for the kicker, for the editor", () => {
  test("a document with no kicker gets an empty one first; one with a kicker is left alone", () => {
    const bare = doc(titleNodeFrom("T"), p("x"));
    expect(withKickerSlot(bare).content![0]).toEqual({ type: KICKER_NODE });
    expect(withKickerSlot(bare).content!.slice(1)).toEqual(bare.content!);
    const has = doc(kickerNodeFrom("A"), titleNodeFrom("T"));
    expect(withKickerSlot(has)).toEqual(has);
  });
  test("taking the empty kicker away again gives back the same document", () => {
    const bare = doc(titleNodeFrom("T"), p("x"));
    expect(withoutEmptyKicker(withKickerSlot(bare))).toEqual(bare);
    const has = doc(kickerNodeFrom("A"), titleNodeFrom("T"));
    expect(withoutEmptyKicker(has)).toEqual(has);
  });
});

describe("a row saved with only a title column keeps the email it had: the line under the title", () => {
  test("the default's kicker becomes the paragraph under the title it always was", () => {
    const def = {
      title: "Título",
      doc: buildMessageDoc({
        key: "booking_confirmed",
        kicker: "Reserva confirmada",
        title: "Título",
        intro: doc(p("Cuerpo.")),
        outro: null,
      }),
    };
    const out = convertOldShape(
      { title: "Mío", doc: null },
      "booking_confirmed",
      def,
    );
    expect(kinds(out).slice(0, 3)).toEqual([
      TITLE_NODE,
      "paragraph",
      "paragraph",
    ]);
    expect(titleText(docTitle(out))).toBe("Mío");
    expect(out.content![1]).toEqual(p("Reserva confirmada"));
    expect(docKicker(out)).toBeUndefined();
  });
});
