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

describe("readRows with the document of the whole email", () => {
  it("a message saved with the editor is read back as it was saved, for every message and both languages", async () => {
    const { MESSAGE_KEYS } = await import("./catalog");
    const { defaultContent } = await import("@/emails/defaults");
    for (const key of MESSAGE_KEYS) {
      for (const locale of ["es", "en"] as const) {
        const base = defaultContent(key, locale).doc;
        // The default with one sentence changed: an edit, as the editor saves it.
        const doc = {
          ...base,
          content: (base.content ?? []).map((n, i) =>
            n.type === "paragraph" &&
            i === (base.content ?? []).findIndex((x) => x.type === "paragraph")
              ? {
                  type: "paragraph",
                  content: [{ type: "text", text: "Una frase del centro." }],
                }
              : n,
          ),
        };
        const [out] = readRows([row({ key, locale, doc })]);
        expect({ key, locale, corrupt: out?.corrupt }).toEqual({
          key,
          locale,
          corrupt: undefined,
        });
        expect(out?.doc).toEqual(doc);
      }
    }
  });

  it("a title and blocks at the top level are not forbidden", () => {
    const [out] = readRows([
      row({
        doc: {
          type: "doc",
          content: [
            { type: "emailTitle", content: [{ type: "text", text: "Hola" }] },
            { type: "systemBlock", attrs: { kind: "cancel_link" } },
          ],
        },
      }),
    ]);
    expect(out?.corrupt).toBeUndefined();
    expect(out?.doc).not.toBeNull();
  });

  it("a document that is really corrupt is still read as corrupt: raw HTML, a bad link, a block inside a section", () => {
    const bad = [
      {
        type: "doc",
        content: [
          { type: "emailTitle", content: [] },
          { type: "htmlCodeBlock", attrs: { html: "<script>" } },
        ],
      },
      {
        type: "doc",
        content: [
          { type: "emailTitle", content: [] },
          {
            type: "section",
            content: [{ type: "systemBlock", attrs: { kind: "cancel_link" } }],
          },
        ],
      },
      {
        type: "doc",
        content: [
          { type: "emailTitle", content: [] },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "x",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        ],
      },
    ];
    for (const doc of bad) {
      const [out] = readRows([row({ doc })]);
      expect(out?.corrupt).toBe(true);
      expect(out?.doc).toBeNull();
    }
  });
});
