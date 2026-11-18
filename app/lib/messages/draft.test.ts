import { describe, expect, test } from "bun:test";
import {
  MAX_DRAFT_BYTES,
  clearDraft,
  decodeDraft,
  draftKey,
  emailDraftOffer,
  whatsappDraftOffer,
  encodeDraft,
  readDraft,
  validateEmailDraft,
  validateWhatsAppDraft,
  writeDraft,
  type DraftStorage,
} from "./draft";

const fields = {
  subject: "Asunto {{first_name}}",
  preheader: "Pre",
  doc: { type: "doc", content: [{ type: "paragraph" }] },
} as never;

const memory = (): DraftStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

const throwing = (): DraftStorage => ({
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
});

describe("draftKey", () => {
  test("is per channel, message and language, and only for those", () => {
    expect(draftKey("email", "booking_confirmed", "es")).toBe(
      "messages-draft:email:booking_confirmed:es",
    );
    expect(draftKey("whatsapp", "booking_paid", "en")).toBe(
      "messages-draft:whatsapp:booking_paid:en",
    );
  });
});

describe("encodeDraft / decodeDraft", () => {
  test("round-trips an email draft", () => {
    const raw = encodeDraft("email", fields);
    expect(raw).not.toBeNull();
    expect(decodeDraft(raw, "email", validateEmailDraft)).toEqual(fields);
  });
  test("carries a version and what it is for", () => {
    const parsed = JSON.parse(encodeDraft("email", fields) as string);
    // 2: an older draft (it had a title of its own) has no place in this shape.
    expect(parsed.v).toBe(2);
    expect(parsed.kind).toBe("email");
  });
  test("a draft of another version, another kind or no shape is ignored", () => {
    const raw = JSON.parse(encodeDraft("email", fields) as string);
    expect(
      decodeDraft(
        JSON.stringify({ ...raw, v: 1 }),
        "email",
        validateEmailDraft,
      ),
    ).toBeNull();
    expect(
      decodeDraft(
        JSON.stringify({ ...raw, kind: "whatsapp" }),
        "email",
        validateEmailDraft,
      ),
    ).toBeNull();
    expect(
      decodeDraft(
        JSON.stringify({ v: 2, kind: "email" }),
        "email",
        validateEmailDraft,
      ),
    ).toBeNull();
    expect(decodeDraft("not json", "email", validateEmailDraft)).toBeNull();
    expect(decodeDraft("", "email", validateEmailDraft)).toBeNull();
    expect(decodeDraft(null, "email", validateEmailDraft)).toBeNull();
    expect(decodeDraft("42", "email", validateEmailDraft)).toBeNull();
    expect(decodeDraft("null", "email", validateEmailDraft)).toBeNull();
  });
  test("a body that is not a document makes the draft unreadable", () => {
    const bad = { ...(fields as object), doc: "<p>hi</p>" };
    expect(
      decodeDraft(
        JSON.stringify({ v: 2, kind: "email", data: bad }),
        "email",
        validateEmailDraft,
      ),
    ).toBeNull();
    const bad2 = { ...(fields as object), doc: { type: "doc", content: "x" } };
    expect(
      decodeDraft(
        JSON.stringify({ v: 2, kind: "email", data: bad2 }),
        "email",
        validateEmailDraft,
      ),
    ).toBeNull();
    const bad3 = { ...(fields as object), subject: 5 };
    expect(
      decodeDraft(
        JSON.stringify({ v: 2, kind: "email", data: bad3 }),
        "email",
        validateEmailDraft,
      ),
    ).toBeNull();
  });
  test("one that is too big is not stored at all", () => {
    const big = {
      ...(fields as object),
      subject: "x".repeat(MAX_DRAFT_BYTES + 1),
    } as never;
    expect(encodeDraft("email", big)).toBeNull();
  });
});

describe("the WhatsApp draft", () => {
  const draft = {
    templateId: "t1",
    params: [
      { kind: "field", field: "first_name" },
      { kind: "static", value: "hola" },
    ],
  } as never;
  test("round-trips", () => {
    expect(
      decodeDraft(
        encodeDraft("whatsapp", draft),
        "whatsapp",
        validateWhatsAppDraft,
      ),
    ).toEqual(draft);
  });
  test("no template is allowed (it can be cleared), a template of the wrong type is not", () => {
    const none = { templateId: null, params: [] } as never;
    expect(
      decodeDraft(
        encodeDraft("whatsapp", none),
        "whatsapp",
        validateWhatsAppDraft,
      ),
    ).toEqual(none);
    const wrong = JSON.stringify({
      v: 1,
      kind: "whatsapp",
      data: { templateId: 3, params: [] },
    });
    expect(decodeDraft(wrong, "whatsapp", validateWhatsAppDraft)).toBeNull();
  });
  test("a parameter that is neither a field nor a fixed text is unreadable", () => {
    const wrong = JSON.stringify({
      v: 1,
      kind: "whatsapp",
      data: { templateId: "t", params: [{ kind: "x" }] },
    });
    expect(decodeDraft(wrong, "whatsapp", validateWhatsAppDraft)).toBeNull();
    const notArray = JSON.stringify({
      v: 1,
      kind: "whatsapp",
      data: { templateId: "t", params: {} },
    });
    expect(decodeDraft(notArray, "whatsapp", validateWhatsAppDraft)).toBeNull();
  });
});

describe("storage that is not there, or throws", () => {
  const key = "messages-draft:email:booking_confirmed:es";
  test("with no storage at all nothing happens and nothing throws", () => {
    expect(readDraft(null, key, "email", validateEmailDraft)).toBeNull();
    expect(() => writeDraft(null, key, "email", fields)).not.toThrow();
    expect(() => clearDraft(null, key)).not.toThrow();
  });
  test("a storage that throws is the same: no draft, no error", () => {
    const s = throwing();
    expect(readDraft(s, key, "email", validateEmailDraft)).toBeNull();
    expect(writeDraft(s, key, "email", fields)).toBe(false);
    expect(() => clearDraft(s, key)).not.toThrow();
  });
  test("writes, reads and clears", () => {
    const s = memory();
    expect(writeDraft(s, key, "email", fields)).toBe(true);
    expect(readDraft(s, key, "email", validateEmailDraft)).toEqual(fields);
    clearDraft(s, key);
    expect(readDraft(s, key, "email", validateEmailDraft)).toBeNull();
  });
  test("a draft too big to keep removes the old one instead of leaving it stale", () => {
    const s = memory();
    writeDraft(s, key, "email", fields);
    const big = {
      ...(fields as object),
      subject: "x".repeat(MAX_DRAFT_BYTES + 1),
    } as never;
    expect(writeDraft(s, key, "email", big)).toBe(false);
    expect(s.data.has(key)).toBe(false);
  });
  test("a stored value of another version is read as nothing", () => {
    const s = memory();
    s.data.set(key, JSON.stringify({ v: 9, kind: "email", data: fields }));
    expect(readDraft(s, key, "email", validateEmailDraft)).toBeNull();
  });
});

describe("what is worth offering", () => {
  const saved = fields as {
    subject: string;
    preheader: string;
    doc: unknown;
  } as never;
  test("a draft identical to what is saved is not offered", () => {
    expect(emailDraftOffer(saved, saved)).toBeNull();
    expect(
      emailDraftOffer(
        { ...(saved as object), subject: "  Asunto {{first_name}}  " } as never,
        saved,
      ),
    ).toBeNull();
  });
  test("one that differs in any field is", () => {
    for (const field of ["subject", "preheader"]) {
      const draft = { ...(saved as object), [field]: "otro" } as never;
      expect(emailDraftOffer(draft, saved)).toBe(draft);
    }
    const body = {
      ...(saved as object),
      doc: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x" }] },
        ],
      },
    } as never;
    expect(emailDraftOffer(body, saved)).toBe(body);
  });
  test("no draft, nothing to offer", () => {
    expect(emailDraftOffer(null, saved)).toBeNull();
    expect(
      whatsappDraftOffer(null, { templateId: null, params: [] }),
    ).toBeNull();
  });
  test("WhatsApp: the same template and parameters is nothing, another is a draft", () => {
    const base = {
      templateId: "t",
      params: [{ kind: "static", value: "a" }],
    } as never;
    expect(
      whatsappDraftOffer({ ...(base as object) } as never, base),
    ).toBeNull();
    const other = {
      templateId: "t",
      params: [{ kind: "static", value: "b" }],
    } as never;
    expect(whatsappDraftOffer(other, base)).toBe(other);
    const tpl = {
      templateId: "u",
      params: [{ kind: "static", value: "a" }],
    } as never;
    expect(whatsappDraftOffer(tpl, base)).toBe(tpl);
  });
});
