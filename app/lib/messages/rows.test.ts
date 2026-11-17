import { describe, expect, it } from "bun:test";
import { readRows } from "./rows";

const row = (over: Record<string, unknown> = {}) => ({
  key: "booking_reminder",
  channel: "email",
  locale: "es",
  enabled: true,
  subject: "Hola",
  preheader: null,
  title: null,
  doc: { type: "doc", content: [{ type: "paragraph" }] },
  whatsapp_template_id: null,
  whatsapp_params: [],
  updated_at: "2026-11-17T10:00:00Z",
  ...over,
});

describe("readRows", () => {
  it("passes a well-formed row through", () => {
    const [out] = readRows([row()]);
    expect(out).toMatchObject({
      key: "booking_reminder",
      channel: "email",
      locale: "es",
      enabled: true,
      subject: "Hola",
    });
    expect(out?.corrupt).toBeUndefined();
  });

  it("keeps each row's own data: nothing is shared between keys", () => {
    const out = readRows([
      row({ key: "booking_reminder", subject: "A" }),
      row({ key: "booking_confirmed", subject: "B", doc: null }),
    ]);
    expect(out.map((r) => [r.key, r.subject, r.doc === null])).toEqual([
      ["booking_reminder", "A", false],
      ["booking_confirmed", "B", true],
    ]);
  });

  it("leaves out a row for a key, channel or language the catalogue does not know", () => {
    expect(
      readRows([
        row({ key: "plan-test-x" }),
        row({ channel: "sms" }),
        row({ locale: "fr" }),
        row(),
      ]),
    ).toHaveLength(1);
  });

  it("leaves out something that is not a row", () => {
    expect(readRows([null, "x", 3, [], row()])).toHaveLength(1);
  });

  for (const [label, doc] of [
    ["a string", "text"],
    ["an array", []],
    ["a number", 3],
    ["an object of another type", { type: "paragraph", content: [] }],
    ["a document whose content is not a list", { type: "doc", content: "x" }],
    [
      "a document with a node that has no type",
      { type: "doc", content: [{ content: [] }] },
    ],
    [
      "a document with a child that is not an object",
      { type: "doc", content: [{ type: "paragraph", content: ["x"] }] },
    ],
  ] as const) {
    it(`a corrupt body (${label}) comes back as null and flagged, not as a failure`, () => {
      const out = readRows([row({ doc }), row({ key: "booking_confirmed" })]);
      expect(out).toHaveLength(2);
      expect(out[0]?.doc).toBeNull();
      expect(out[0]?.corrupt).toBe(true);
      expect(out[1]?.corrupt).toBeUndefined();
    });
  }

  it("a document nested absurdly deep is corrupt, not a stack overflow", () => {
    let node: Record<string, unknown> = { type: "paragraph" };
    for (let i = 0; i < 20_000; i += 1) {
      node = { type: "blockquote", content: [node] };
    }
    const [out] = readRows([row({ doc: { type: "doc", content: [node] } })]);
    expect(out?.corrupt).toBe(true);
    expect(out?.doc).toBeNull();
  });

  it("a body with a raw-HTML block or an address the sanitiser refuses is corrupt, never sent to the browser as it is", () => {
    for (const bad of [
      { type: "htmlCodeBlock", attrs: { html: "<script>x</script>" } },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
      { type: "button", attrs: { text: "Ir", url: "data:text/html,x" } },
    ]) {
      const [out] = readRows([row({ doc: { type: "doc", content: [bad] } })]);
      expect(out?.corrupt).toBe(true);
      expect(out?.doc).toBeNull();
    }
  });

  it("a body deeper than a save would accept is corrupt", () => {
    const nest = (depth: number) => {
      let node: Record<string, unknown> = { type: "paragraph" };
      for (let level = 3; level <= depth; level += 1) {
        node = { type: "blockquote", content: [node] };
      }
      return { type: "doc", content: [node] };
    };
    expect(readRows([row({ doc: nest(30) })])[0]?.corrupt).toBeUndefined();
    expect(readRows([row({ doc: nest(31) })])[0]?.corrupt).toBe(true);
  });

  it("an empty document and a null one are fine", () => {
    for (const doc of [{ type: "doc", content: [] }, null]) {
      const [out] = readRows([row({ doc })]);
      expect(out?.corrupt).toBeUndefined();
    }
  });

  it("WhatsApp parameters that are not a list become an empty one", () => {
    const [out] = readRows([row({ whatsapp_params: "x" })]);
    expect(out?.whatsapp_params).toEqual([]);
  });

  it("reads the switch as a boolean: only a false is off", () => {
    expect(readRows([row({ enabled: false })])[0]?.enabled).toBe(false);
    expect(readRows([row({ enabled: null })])[0]?.enabled).toBe(true);
  });

  it("the text columns are strings or null", () => {
    const [out] = readRows([row({ subject: 5, title: {}, preheader: "p" })]);
    expect(out).toMatchObject({ subject: null, title: null, preheader: "p" });
  });
});
