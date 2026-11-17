import { describe, expect, it } from "bun:test";
import type { EmailDoc } from "@/types/campaign";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "./catalog";
import {
  MAX_DOC_CHARS,
  toRowPayload,
  validateMessageTemplate,
  type MessageTemplateWrite,
} from "./schema";

const UUID = "3b7c1f6e-0d9a-4b52-8c1e-5a2f9d4e7b10";

const text = (value: string) => ({ type: "text", text: value });
const para = (...children: EmailDoc[]): EmailDoc => ({
  type: "paragraph",
  content: children,
});
const doc = (...nodes: EmailDoc[]): EmailDoc => ({
  type: "doc",
  content: nodes,
});
const linked = (href: string): EmailDoc => ({
  type: "text",
  text: "aquí",
  marks: [{ type: "link", attrs: { href } }],
});

const email = (over: Record<string, unknown> = {}) => ({
  key: "booking_confirmed",
  channel: "email",
  locale: "es",
  enabled: true,
  subject: "Tu cita, {{first_name}}",
  preheader: "Nos vemos pronto",
  title: "Hola {{first_name}}",
  doc: doc(para(text("Te esperamos el {{date}}."))),
  ...over,
});

const whatsapp = (over: Record<string, unknown> = {}) => ({
  key: "booking_reminder",
  channel: "whatsapp",
  locale: "es",
  enabled: true,
  whatsappTemplateId: UUID,
  whatsappParams: [
    { kind: "field", field: "first_name" },
    { kind: "static", value: "Essentia" },
  ],
  ...over,
});

function errorsOf(input: unknown): Record<string, string> {
  const result = validateMessageTemplate(input);
  if (result.ok) throw new Error("expected the input to be refused");
  return result.fieldErrors;
}

function accepted(input: unknown): MessageTemplateWrite {
  const result = validateMessageTemplate(input);
  if (!result.ok) {
    throw new Error(`expected it valid: ${JSON.stringify(result.fieldErrors)}`);
  }
  return result.data;
}

describe("validateMessageTemplate — email, the valid case", () => {
  it("accepts a full message and hands back the content to store", () => {
    const out = accepted(email());
    expect(out).toMatchObject({
      key: "booking_confirmed",
      channel: "email",
      locale: "es",
      enabled: true,
    });
    if (out.channel !== "email") throw new Error("channel");
    expect(out.content).toEqual({
      subject: "Tu cita, {{first_name}}",
      preheader: "Nos vemos pronto",
      title: "Hola {{first_name}}",
      doc: doc(para(text("Te esperamos el {{date}}."))),
    });
  });

  it("accepts every key and both languages", () => {
    for (const key of MESSAGE_KEYS) {
      for (const locale of ["en", "es"]) {
        expect(
          validateMessageTemplate(
            email({ key, locale, subject: "Hola", title: "Hola", doc: null }),
          ).ok,
        ).toBe(true);
      }
    }
  });

  it("trims the text and keeps an empty body as null", () => {
    const out = accepted(email({ subject: "  Asunto  ", doc: doc(para()) }));
    if (out.channel !== "email") throw new Error("channel");
    expect(out.content?.subject).toBe("Asunto");
    expect(out.content?.doc).toBeNull();
  });
});

describe("validateMessageTemplate — the switch alone creates no content", () => {
  it("a reminder switched off with no text stores no content at all", () => {
    const out = accepted({
      key: "booking_reminder",
      channel: "email",
      locale: "es",
      enabled: false,
    });
    expect(out).toEqual({
      key: "booking_reminder",
      channel: "email",
      locale: "es",
      enabled: false,
      content: null,
    });
  });

  it("switching it back on is the same: still no content", () => {
    const out = accepted({
      key: "booking_reminder",
      channel: "email",
      locale: "en",
      enabled: true,
    });
    if (out.channel !== "email") throw new Error("channel");
    expect(out.content).toBeNull();
  });

  it("explicit but empty fields store NULLs, never the default text", () => {
    const out = accepted(
      email({
        key: "booking_reminder",
        enabled: false,
        subject: "",
        preheader: "  ",
        title: "",
        doc: doc(para()),
      }),
    );
    if (out.channel !== "email") throw new Error("channel");
    expect(out.content).toEqual({
      subject: null,
      preheader: null,
      title: null,
      doc: null,
    });
  });

  it("a null doc and null texts are 'not brought' too", () => {
    const out = accepted(
      email({ subject: null, preheader: null, title: null, doc: null }),
    );
    if (out.channel !== "email") throw new Error("channel");
    expect(out.content).toEqual({
      subject: null,
      preheader: null,
      title: null,
      doc: null,
    });
  });

  it("with some text, a title the admin cleared stays empty and a missing field is null", () => {
    const out = accepted(
      email({ subject: "Hola", title: "", preheader: undefined, doc: null }),
    );
    if (out.channel !== "email") throw new Error("channel");
    expect(out.content).toEqual({
      subject: "Hola",
      preheader: null,
      title: "",
      doc: null,
    });
  });
});

describe("validateMessageTemplate — limits", () => {
  const lengths: [string, number][] = [
    ["subject", 120],
    ["preheader", 150],
    ["title", 200],
  ];
  for (const [field, max] of lengths) {
    it(`${field}: ${max} characters pass, ${max + 1} do not`, () => {
      expect(
        validateMessageTemplate(email({ [field]: "a".repeat(max) })).ok,
      ).toBe(true);
      expect(errorsOf(email({ [field]: "a".repeat(max + 1) }))).toEqual({
        [field]: `${field}TooLong`,
      });
    });
  }

  it("counts the limit after trimming", () => {
    expect(
      validateMessageTemplate(email({ subject: ` ${"a".repeat(120)} ` })).ok,
    ).toBe(true);
  });

  it("a document just under the size limit passes, one over it does not", () => {
    const wrap = (n: number) => doc(para(text("x".repeat(n))));
    const overhead = JSON.stringify(wrap(0)).length;
    expect(
      validateMessageTemplate(email({ doc: wrap(MAX_DOC_CHARS - overhead) }))
        .ok,
    ).toBe(true);
    expect(
      errorsOf(email({ doc: wrap(MAX_DOC_CHARS - overhead + 1) })),
    ).toEqual({ doc: "docTooLarge" });
  });

  it("a very deep document is refused, not a crash", () => {
    let node: EmailDoc = para(text("x"));
    for (let i = 0; i < 5_000; i += 1)
      node = { type: "blockquote", content: [node] };
    const out = validateMessageTemplate(email({ doc: doc(node) }));
    expect(out.ok).toBe(false);
  });
});

describe("validateMessageTemplate — shape", () => {
  it("refuses a key outside the catalogue", () => {
    expect(errorsOf(email({ key: "nope" }))).toEqual({ key: "invalidInput" });
  });

  it("refuses a channel or a language it does not know", () => {
    expect(errorsOf(email({ channel: "sms" }))).toEqual({
      channel: "invalidInput",
    });
    expect(errorsOf(email({ locale: "fr" }))).toEqual({
      locale: "invalidInput",
    });
  });

  it("refuses something that is not an object", () => {
    for (const input of [null, undefined, "x", 3, []]) {
      expect(validateMessageTemplate(input).ok).toBe(false);
    }
  });

  it("refuses a body that is not a document", () => {
    expect(errorsOf(email({ doc: { type: "paragraph" } }))).toEqual({
      doc: "invalidInput",
    });
    expect(errorsOf(email({ doc: "text" })).doc).toBe("invalidInput");
  });

  it("a non-boolean switch is refused", () => {
    expect(errorsOf(email({ enabled: "no" }))).toEqual({
      enabled: "invalidInput",
    });
  });
});

describe("validateMessageTemplate — only the reminder can be switched off", () => {
  for (const key of MESSAGE_KEYS) {
    if (MESSAGE_CATALOG[key].canDisable) {
      it(`${key} can be switched off`, () => {
        expect(validateMessageTemplate(email({ key, enabled: false })).ok).toBe(
          true,
        );
      });
    } else {
      it(`${key} cannot: a client who paid would be left without it`, () => {
        const plain = { subject: "Hola", title: "Hola", doc: null };
        expect(errorsOf(email({ key, enabled: false, ...plain }))).toEqual({
          enabled: "cannotDisable",
        });
        // Also when only the switch is sent.
        expect(
          errorsOf({ key, channel: "email", locale: "es", enabled: false }),
        ).toEqual({ enabled: "cannotDisable" });
      });
    }
  }
});

describe("validateMessageTemplate — variables", () => {
  const unknown = (input: Record<string, unknown>) => {
    const result = validateMessageTemplate(email(input));
    if (result.ok) throw new Error("expected a refusal");
    return result;
  };

  it("flags an unknown variable in the subject", () => {
    expect(unknown({ subject: "Hola {{nope}}" }).fieldErrors).toEqual({
      subject: "unknownVariable",
    });
  });

  it("flags one in the preheader and in the title", () => {
    expect(unknown({ preheader: "{{nope}}" }).fieldErrors).toEqual({
      preheader: "unknownVariable",
    });
    expect(unknown({ title: "{{nope}}" }).fieldErrors).toEqual({
      title: "unknownVariable",
    });
  });

  it("flags one in the text of the document, with the path to the node", () => {
    const result = unknown({
      doc: doc(para(text("ok")), para(text("Hola "), text("{{nope}}"))),
    });
    expect(result.fieldErrors).toEqual({
      "doc.content.1.content.1.text": "unknownVariable",
    });
    expect(result.unknownVariables).toEqual(["nope"]);
  });

  it("flags a variable node the message does not offer", () => {
    const result = unknown({
      doc: doc(para({ type: "variable", attrs: { id: "cancel_url" } })),
      key: "booking_cancelled",
    });
    expect(result.fieldErrors).toEqual({
      "doc.content.0.content.0.attrs.id": "unknownVariable",
    });
  });

  it("accepts a variable node the message offers", () => {
    expect(
      validateMessageTemplate(
        email({
          doc: doc(para({ type: "variable", attrs: { id: "first_name" } })),
        }),
      ).ok,
    ).toBe(true);
  });

  it("flags one inside a link's address", () => {
    const result = unknown({
      doc: doc(para(linked("https://example.com/{{nope}}"))),
    });
    expect(Object.values(result.fieldErrors)).toContain("unknownVariable");
    expect(
      Object.keys(result.fieldErrors).some((path) => path.endsWith("href")),
    ).toBe(true);
  });

  it("flags one in a button's address", () => {
    const result = unknown({
      doc: doc({ type: "button", attrs: { text: "Ir", url: "{{nope}}" } }),
    });
    expect(result.fieldErrors["doc.content.0.attrs.url"]).toBe(
      "unknownVariable",
    );
    expect(result.unknownVariables).toEqual(["nope"]);
  });

  it("flags a link the editor marked as a variable when the name is not offered", () => {
    const button = (name: string): EmailDoc => ({
      type: "button",
      attrs: { text: "Ir", url: name, isUrlVariable: true },
    });
    expect(
      errorsOf(
        email({ key: "booking_cancelled", doc: doc(button("cancel_url")) }),
      ),
    ).toEqual({ "doc.content.0.attrs.url": "unknownVariable" });
    expect(
      validateMessageTemplate(
        email({ key: "booking_reminder", doc: doc(button("cancel_url")) }),
      ).ok,
    ).toBe(true);
  });

  it("reads a variable the way the renderer does: capitals count", () => {
    expect(unknown({ subject: "{{First_Name}}" }).fieldErrors).toEqual({
      subject: "unknownVariable",
    });
  });

  it("a variable belongs to the message that offers it", () => {
    expect(
      validateMessageTemplate(
        email({ key: "booking_reminder", subject: "{{cancel_url}}" }),
      ).ok,
    ).toBe(true);
    expect(
      errorsOf(email({ key: "booking_cancelled", subject: "{{cancel_url}}" })),
    ).toEqual({ subject: "unknownVariable" });
  });

  it("names every unknown variable once", () => {
    const result = unknown({
      subject: "{{a}} {{b}}",
      title: "{{a}}",
    });
    expect(result.unknownVariables).toEqual(["a", "b"]);
  });
});

describe("validateMessageTemplate — links", () => {
  const linkBody = (href: string) => doc(para(linked(href)));

  for (const href of [
    "https://example.com/x",
    "http://example.com/x",
    "mailto:hola@example.com",
    "#",
    "{{cancel_url}}",
    "  https://example.com  ",
  ]) {
    it(`accepts ${JSON.stringify(href)}`, () => {
      expect(
        validateMessageTemplate(
          email({ key: "booking_reminder", doc: linkBody(href) }),
        ).ok,
      ).toBe(true);
    });
  }

  for (const href of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,x",
    "vbscript:x",
    "ftp://example.com",
    "/relative",
    "//example.com",
  ]) {
    it(`refuses ${JSON.stringify(href)}`, () => {
      const errors = errorsOf(email({ doc: linkBody(href) }));
      expect(Object.values(errors)).toEqual(["linkNotAllowed"]);
      expect(Object.keys(errors)[0]).toBe("doc.content.0.content.0.marks.0");
    });
  }

  it("leaves a link made of a variable to be judged when it is sent", () => {
    for (const href of ["{{first_name}}", "{{cancel_url}}/x", ""]) {
      expect(validateMessageTemplate(email({ doc: linkBody(href) })).ok).toBe(
        true,
      );
    }
  });

  it("refuses a raw HTML block", () => {
    expect(
      errorsOf(
        email({
          doc: doc({ type: "htmlCodeBlock", attrs: { html: "<b>x</b>" } }),
        }),
      ),
    ).toEqual({ "doc.content.0": "blockNotAllowed" });
  });

  it("applies to a button's address and to an image's", () => {
    expect(
      errorsOf(
        email({
          doc: doc({
            type: "button",
            attrs: { text: "Ir", url: "javascript:x" },
          }),
        }),
      ),
    ).toEqual({ "doc.content.0": "linkNotAllowed" });
    expect(
      errorsOf(
        email({
          doc: doc({
            type: "image",
            attrs: { src: "https://example.com/a.png", externalLink: "data:x" },
          }),
        }),
      ),
    ).toEqual({ "doc.content.0": "linkNotAllowed" });
  });

  it("a text that merely reads like a link is not a link", () => {
    expect(
      validateMessageTemplate(
        email({ doc: doc(para(text("javascript:alert(1)"))) }),
      ).ok,
    ).toBe(true);
  });
});

describe("validateMessageTemplate — WhatsApp", () => {
  it("accepts the valid case on every eligible key", () => {
    for (const key of MESSAGE_KEYS) {
      if (!MESSAGE_CATALOG[key].whatsappEligible) continue;
      const out = accepted(whatsapp({ key }));
      if (out.channel !== "whatsapp") throw new Error("channel");
      expect(out.whatsapp).toEqual({
        templateId: UUID,
        params: [
          { kind: "field", field: "first_name" },
          { kind: "static", value: "Essentia" },
        ],
      });
    }
  });

  it("refuses WhatsApp on a message that is not eligible", () => {
    for (const key of MESSAGE_KEYS) {
      if (MESSAGE_CATALOG[key].whatsappEligible) continue;
      expect(errorsOf(whatsapp({ key }))).toEqual({
        channel: "channelNotAllowed",
      });
    }
  });

  it("needs a template that is a uuid", () => {
    expect(errorsOf(whatsapp({ whatsappTemplateId: "abc" }))).toEqual({
      whatsappTemplateId: "templateRequired",
    });
    expect(errorsOf(whatsapp({ whatsappTemplateId: null }))).toEqual({
      whatsappTemplateId: "templateRequired",
    });
  });

  it("a switched-off message may carry no template", () => {
    const out = accepted(
      whatsapp({
        enabled: false,
        whatsappTemplateId: null,
        whatsappParams: [],
      }),
    );
    if (out.channel !== "whatsapp") throw new Error("channel");
    expect(out.whatsapp).toEqual({ templateId: null, params: [] });
  });

  it("the switch alone brings no template and changes none", () => {
    const out = accepted({
      key: "booking_reminder",
      channel: "whatsapp",
      locale: "es",
      enabled: false,
    });
    if (out.channel !== "whatsapp") throw new Error("channel");
    expect(out.whatsapp).toBeNull();
  });

  it("only lets a parameter read a field the message offers", () => {
    expect(
      errorsOf(
        whatsapp({
          key: "booking_paid",
          whatsappParams: [
            { kind: "field", field: "first_name" },
            { kind: "field", field: "session_type" },
          ],
        }),
      ),
    ).toEqual({ "whatsappParams.1": "paramFieldNotOffered" });
    expect(
      errorsOf(
        whatsapp({ whatsappParams: [{ kind: "field", field: "post_title" }] }),
      ),
    ).toEqual({ "whatsappParams.0": "paramFieldNotOffered" });
  });

  it("limits a fixed text to 200 characters", () => {
    expect(
      validateMessageTemplate(
        whatsapp({
          whatsappParams: [{ kind: "static", value: "a".repeat(200) }],
        }),
      ).ok,
    ).toBe(true);
    expect(
      errorsOf(
        whatsapp({
          whatsappParams: [{ kind: "static", value: "a".repeat(201) }],
        }),
      ),
    ).toEqual({ "whatsappParams.0": "paramTooLong" });
  });

  it("ignores the email fields on a WhatsApp message", () => {
    const out = accepted(whatsapp({ subject: "x", doc: doc(para(text("y"))) }));
    expect(toRowPayload(out, "u", "now")).toMatchObject({
      subject: null,
      doc: null,
    });
  });
});

describe("toRowPayload", () => {
  const NOW = "2026-11-17T10:00:00.000Z";

  it("an email with content writes the four fields and clears the WhatsApp columns", () => {
    expect(toRowPayload(accepted(email()), "admin-1", NOW)).toEqual({
      key: "booking_confirmed",
      channel: "email",
      locale: "es",
      enabled: true,
      subject: "Tu cita, {{first_name}}",
      preheader: "Nos vemos pronto",
      title: "Hola {{first_name}}",
      doc: doc(para(text("Te esperamos el {{date}}."))),
      whatsapp_template_id: null,
      whatsapp_params: [],
      updated_by: "admin-1",
      updated_at: NOW,
    });
  });

  it("the switch alone leaves the content columns out, so an existing text is not wiped", () => {
    const payload = toRowPayload(
      accepted({
        key: "booking_reminder",
        channel: "email",
        locale: "es",
        enabled: false,
      }),
      "admin-1",
      NOW,
    );
    expect(payload).toEqual({
      key: "booking_reminder",
      channel: "email",
      locale: "es",
      enabled: false,
      updated_by: "admin-1",
      updated_at: NOW,
    });
    expect(payload).not.toHaveProperty("subject");
    expect(payload).not.toHaveProperty("doc");
  });

  it("an explicit empty email does write the NULLs", () => {
    const payload = toRowPayload(
      accepted(email({ subject: "", title: "", preheader: "", doc: null })),
      "admin-1",
      NOW,
    );
    expect(payload).toMatchObject({
      subject: null,
      preheader: null,
      title: null,
      doc: null,
    });
  });

  it("a WhatsApp message writes the template and the parameters, and no email text", () => {
    expect(toRowPayload(accepted(whatsapp()), "admin-1", NOW)).toEqual({
      key: "booking_reminder",
      channel: "whatsapp",
      locale: "es",
      enabled: true,
      subject: null,
      preheader: null,
      title: null,
      doc: null,
      whatsapp_template_id: UUID,
      whatsapp_params: [
        { kind: "field", field: "first_name" },
        { kind: "static", value: "Essentia" },
      ],
      updated_by: "admin-1",
      updated_at: NOW,
    });
  });

  it("the WhatsApp switch alone leaves the template columns out", () => {
    const payload = toRowPayload(
      accepted({
        key: "booking_reminder",
        channel: "whatsapp",
        locale: "es",
        enabled: false,
      }),
      "admin-1",
      NOW,
    );
    expect(payload).not.toHaveProperty("whatsapp_template_id");
    expect(payload).not.toHaveProperty("whatsapp_params");
    expect(payload).not.toHaveProperty("subject");
  });
});
