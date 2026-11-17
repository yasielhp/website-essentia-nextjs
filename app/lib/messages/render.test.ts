import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { defaultContent } from "@/emails/defaults";
import { blocksToDoc } from "@/lib/campaigns/doc";
import { MESSAGE_KEYS } from "./catalog";
import {
  chooseDelivery,
  composeMessageEmail,
  type MessageRow,
} from "./compose";
import { fixedBlocksHtml } from "./fixed-blocks";
import { renderMessageEmail } from "./render";

const row = (over: Partial<MessageRow> = {}): MessageRow => ({
  subject: "Hola {{first_name}} — {{service}}",
  preheader: "Pre {{service}}",
  title: "Título para {{first_name}}",
  doc: blocksToDoc([
    { type: "paragraph", text: "Cuerpo para {{first_name}} el {{date}}." },
  ]),
  enabled: true,
  ...over,
});

const vars = {
  first_name: "Ana & Luis",
  service: "Drenaje",
  date: "jueves, 20 de agosto de 2026",
  time: "10:30",
};

const fixed = () =>
  fixedBlocksHtml("booking_confirmed", {
    locale: "es",
    service: "Drenaje",
    sessionType: "Sesión individual",
    date: vars.date,
    time: "10:30",
    duration: "60 min",
    dateIso: "2026-08-20",
    cancelUrl: "https://example.test/c",
    consentUrl: null,
  });

describe("chooseDelivery", () => {
  test("no row: the email that has always gone out", () => {
    for (const key of MESSAGE_KEYS) {
      expect(chooseDelivery(key, null)).toBe("legacy");
    }
  });

  test("a row with text is the admin's version", () => {
    expect(chooseDelivery("booking_confirmed", row())).toBe("custom");
  });

  test("only the reminder can be switched off", () => {
    const off = row({ enabled: false });
    for (const key of MESSAGE_KEYS) {
      expect(chooseDelivery(key, off)).toBe(
        key === "booking_reminder" ? "skip" : "custom",
      );
    }
  });

  test("a switched-off reminder is skipped even when it has no text", () => {
    const off = row({
      enabled: false,
      subject: null,
      preheader: null,
      title: null,
      doc: null,
    });
    expect(chooseDelivery("booking_reminder", off)).toBe("skip");
  });

  test("a row that only carries the switch has no text to send: legacy", () => {
    const bare = row({
      subject: null,
      preheader: null,
      title: null,
      doc: null,
    });
    expect(chooseDelivery("booking_reminder", bare)).toBe("legacy");
    expect(chooseDelivery("booking_confirmed", bare)).toBe("legacy");
  });

  test("a blank subject alone is not an edit", () => {
    expect(
      chooseDelivery(
        "booking_confirmed",
        row({ subject: "  ", preheader: null, title: null, doc: null }),
      ),
    ).toBe("legacy");
  });
});

describe("composeMessageEmail", () => {
  const compose = (over: Partial<MessageRow> = {}, v = vars) =>
    composeMessageEmail({
      key: "booking_confirmed",
      locale: "es",
      row: row(over),
      vars: v,
      fixedHtml: fixed(),
    });

  test("subject, title and body carry the variables; the HTML ones are escaped", async () => {
    const { subject, html } = await compose();
    // The subject is plain text: no entity.
    expect(subject).toBe("Hola Ana & Luis — Drenaje");
    expect(html).toContain("Título para Ana &amp; Luis");
    expect(html).toContain("Cuerpo para Ana &amp; Luis el jueves");
    expect(html).not.toContain("{{");
  });

  test("a subject that is only a variable with nothing in it is the default subject, never an empty one", async () => {
    // The trial render passes it (the example booking fills everything); a
    // real booking with no session type would have gone out with `subject: ""`.
    for (const subject of [
      "{{session_type}}",
      " {{session_type}} {{duration}} ",
    ]) {
      const out = await compose({ subject });
      expect(out.subject).toBe("Tu reserva ha sido confirmada — Drenaje");
    }
    const filled = await compose({ subject: "{{session_type}}" }, {
      ...vars,
      session_type: "Sesión individual",
    } as typeof vars);
    expect(filled.subject).toBe("Sesión individual");
  });

  test("a subject never carries a line break, its own or a variable's", async () => {
    const hostile = {
      ...vars,
      first_name: "Ana\r\nBcc: intruso@example.test\n\tX-Otro: 1",
      service: "Drenaje\u2028linfático",
    };
    const out = await compose(
      { subject: "Hola {{first_name}}\r\n —  {{service}}\t" },
      hostile,
    );
    expect(out.subject).toBe(
      "Hola Ana Bcc: intruso@example.test X-Otro: 1 — Drenaje linfático",
    );
    expect(out.subject).not.toMatch(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/);
  });

  test("the preheader is one line too", async () => {
    const out = await compose(
      { preheader: "Pre {{first_name}}\n  fin" },
      { ...vars, first_name: "Ana\r\n\tLuis" },
    );
    expect(out.html).toContain(">Pre Ana Luis fin</div>");
  });

  test("with no subject left and no default one either, it refuses to compose", async () => {
    // No default subject is empty; this is the answer if one ever were.
    const defaults = defaultContent("booking_confirmed", "es");
    const original = defaults.subject;
    defaults.subject = "{{session_type}}";
    try {
      await expect(compose({ subject: "{{session_type}}" })).rejects.toThrow(
        /subject/,
      );
      const quiet = spyOn(console, "error").mockImplementation(() => {});
      const out = await renderMessageEmail(
        {
          key: "booking_confirmed",
          locale: "es",
          vars,
          fixedHtml: fixed,
        },
        async () => row({ subject: "{{session_type}}" }),
      );
      quiet.mockRestore();
      expect(out).toEqual({ kind: "legacy" });
    } finally {
      defaults.subject = original;
    }
  });

  test("it is wrapped in the same shell as the legacy emails", async () => {
    const { html } = await compose();
    expect(html).toContain(
      "https://www.essentiawellnessclub.com/logo-email.png",
    );
    expect(html).toContain(
      "Rambla de Santa Cruz, 83, 38004 Santa Cruz de Tenerife",
    );
    // No campaign footer: nobody unsubscribes from a booking email.
    expect(html).not.toContain("Darse de baja");
    expect(html).not.toContain("Unsubscribe");
  });

  test("the fixed blocks come after the body the admin wrote", async () => {
    const { html } = await compose();
    const body = html.indexOf("Cuerpo para");
    expect(body).toBeGreaterThan(-1);
    for (const marker of [
      "Detalles de la sesión",
      "Añadir al calendario",
      "Cancelar mi cita",
    ]) {
      expect(html.indexOf(marker)).toBeGreaterThan(body);
    }
  });

  test("a variable the message does not offer comes out empty, without throwing", async () => {
    const { html } = await composeMessageEmail({
      key: "booking_cancelled",
      locale: "es",
      row: row({
        doc: blocksToDoc([
          { type: "paragraph", text: "Enlace: {{cancel_url}} y {{nope}}." },
        ]),
      }),
      // The caller hands over a cancel_url the message does not offer.
      vars: { first_name: "Ana", cancel_url: "https://example.test/secret" },
      fixedHtml: "",
    });
    expect(html).not.toContain("example.test/secret");
    expect(html).not.toContain("{{");
  });

  test("what the row leaves null falls back to the default text", async () => {
    const { subject, html } = await composeMessageEmail({
      key: "booking_confirmed",
      locale: "es",
      row: row({ subject: null, title: null, preheader: null, doc: null }),
      vars: { first_name: "Ana", service: "Drenaje", date: "hoy" },
      fixedHtml: "",
    });
    expect(subject).toBe("Tu reserva ha sido confirmada — Drenaje");
    expect(html).toContain("Tu reserva ha sido confirmada, Ana.");
    expect(html).toContain("Estamos deseando verte.");
  });

  test("the paid confirmation keeps its own shell, with no borrowed preheader", async () => {
    const { html } = await composeMessageEmail({
      key: "booking_paid",
      locale: "es",
      row: row({ preheader: "" }),
      vars: { first_name: "Ana" },
      fixedHtml: "",
    });
    expect(html).toContain(">ESSENTIA</span>");
    expect(html).toContain(
      "Rambla de Santa Cruz, 83, 38004 Santa Cruz de Tenerife",
    );
    expect(html).not.toContain("logo-email.png");
    expect(html).not.toContain("display:none");
  });

  test("every default renders to a complete email", async () => {
    for (const key of MESSAGE_KEYS) {
      for (const locale of ["es", "en"] as const) {
        const d = defaultContent(key, locale);
        const out = await composeMessageEmail({
          key,
          locale,
          row: {
            subject: d.subject,
            preheader: d.preheader,
            title: d.title,
            doc: d.doc,
            enabled: true,
          },
          vars: { first_name: "Ana" },
          fixedHtml: "",
        });
        expect(out.html.startsWith("<!DOCTYPE html>")).toBe(true);
        expect(out.html).not.toContain("{{");
        expect(out.subject).not.toContain("{{");
      }
    }
  });
});

describe("renderMessageEmail", () => {
  // A fall-back is logged on purpose; the tests that cause one stay quiet.
  let quiet: ReturnType<typeof spyOn>;
  beforeEach(() => {
    quiet = spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => quiet.mockRestore());

  const opts = {
    key: "booking_confirmed" as const,
    locale: "es" as const,
    vars,
    fixedHtml: fixed,
  };

  test("no saved row: legacy, and the fixed blocks are never built", async () => {
    let built = false;
    const out = await renderMessageEmail(
      {
        ...opts,
        fixedHtml: () => {
          built = true;
          return "";
        },
      },
      async () => null,
    );
    expect(out).toEqual({ kind: "legacy" });
    expect(built).toBe(false);
  });

  test("the database cannot be read: legacy, not silence", async () => {
    const out = await renderMessageEmail(opts, async () => {
      throw new Error("db down");
    });
    expect(out).toEqual({ kind: "legacy" });
  });

  test("the render throws: legacy, not a broken email", async () => {
    const out = await renderMessageEmail(
      {
        ...opts,
        fixedHtml: () => {
          throw new Error("boom");
        },
      },
      async () => row(),
    );
    expect(out).toEqual({ kind: "legacy" });
  });

  test("a document of nothing but unknown nodes is not a body: the default one is sent", async () => {
    const out = await renderMessageEmail(opts, async () =>
      row({ doc: { type: "doc", content: [{ type: "nope" }] } }),
    );
    expect(out.kind).toBe("custom");
    if (out.kind !== "custom") return;
    expect(out.html).toContain("Estamos deseando verte.");
  });

  test("a saved row: the admin's version", async () => {
    const out = await renderMessageEmail(opts, async () => row());
    expect(out.kind).toBe("custom");
    if (out.kind !== "custom") return;
    expect(out.subject).toBe("Hola Ana & Luis — Drenaje");
    expect(out.html).toContain("Detalles de la sesión");
  });

  test("the reminder switched off: skip", async () => {
    const out = await renderMessageEmail(
      { ...opts, key: "booking_reminder" },
      async () => row({ enabled: false }),
    );
    expect(out).toEqual({ kind: "skip" });
  });

  test("any other message switched off still sends", async () => {
    for (const key of MESSAGE_KEYS) {
      if (key === "booking_reminder") continue;
      const out = await renderMessageEmail({ ...opts, key }, async () =>
        row({ enabled: false }),
      );
      expect(out.kind).not.toBe("skip");
    }
  });

  test("the row is asked for by key, email channel and the email's language", async () => {
    const asked: unknown[][] = [];
    await renderMessageEmail({ ...opts, locale: "en" }, async (...args) => {
      asked.push(args);
      return null;
    });
    expect(asked).toEqual([["booking_confirmed", "en"]]);
  });
});

describe("a body that is not a document is not an edit", () => {
  const bare = (doc: unknown): MessageRow => ({
    subject: null,
    preheader: null,
    title: null,
    doc: doc as MessageRow["doc"],
    enabled: true,
  });

  for (const [label, doc] of [
    ["a string", "hola"],
    ["an empty object", {}],
    ["an array", []],
    ["a number", 7],
    ["a document with no content", { type: "doc" }],
    ["an empty document", { type: "doc", content: [] }],
    [
      "a document of nothing but unknown nodes",
      { type: "doc", content: [{ type: "render" }, { type: "foo" }] },
    ],
    ["a document with a null in it", { type: "doc", content: [null] }],
    [
      "a document of empty paragraphs",
      { type: "doc", content: [{ type: "paragraph", content: [] }] },
    ],
  ] as const) {
    test(`${label}: nothing edited, so legacy`, () => {
      expect(chooseDelivery("booking_confirmed", bare(doc))).toBe("legacy");
    });
  }

  test("and with a subject beside it, the default body goes out", async () => {
    const { html } = await composeMessageEmail({
      key: "booking_confirmed",
      locale: "es",
      row: { ...bare("hola"), subject: "Asunto" },
      vars: { first_name: "Ana" },
      fixedHtml: "",
    });
    expect(html).toContain("Estamos deseando verte.");
  });

  test("only a switch that is exactly false turns the reminder off", () => {
    for (const enabled of [null, undefined, 0, "false", ""]) {
      const row = { ...bare(null), enabled } as unknown as MessageRow;
      expect(chooseDelivery("booking_reminder", row)).not.toBe("skip");
    }
    const off = { ...bare(null), enabled: false };
    expect(chooseDelivery("booking_reminder", off)).toBe("skip");
  });
});

describe("links in the admin's body", () => {
  const paragraphWithLink = (href: string) => ({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "pulsa aquí",
            marks: [{ type: "link", attrs: { href, target: "_blank" } }],
          },
        ],
      },
      {
        type: "button",
        attrs: {
          text: "Botón",
          url: href,
          alignment: "center",
          variant: "filled",
          borderRadius: "round",
          buttonColor: "#103838",
          textColor: "#f0ede6",
        },
      },
    ],
  });

  const send = (href: string, vars = {}) =>
    composeMessageEmail({
      key: "booking_confirmed",
      locale: "es",
      row: row({ doc: paragraphWithLink(href) }),
      vars,
      fixedHtml: "",
    });

  const hrefs = (html: string) =>
    [...html.matchAll(/href="([^"]*)"/g)]
      .map((m) => m[1]!)
      .filter((h) => !h.includes("fonts.googleapis"));

  for (const bad of [
    "javascript:alert(1)",
    " JaVaScRiPt:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.example/x",
    "",
  ]) {
    test(`${JSON.stringify(bad)} leaves for nowhere`, async () => {
      const { html } = await send(bad);
      expect(hrefs(html)).not.toEqual([]);
      for (const href of hrefs(html)) expect(href).toBe("#");
      expect(html.toLowerCase()).not.toContain("javascript:");
      expect(html.toLowerCase()).not.toContain("data:text");
    });
  }

  for (const good of [
    "https://example.test/a?b=1",
    "http://example.test/",
    "mailto:info@example.test",
  ]) {
    test(`${good} is kept`, async () => {
      const { html } = await send(good);
      expect(hrefs(html).every((h) => h.replace(/&amp;/g, "&") === good)).toBe(
        true,
      );
    });
  }

  test("a variable that holds a link works as a link", async () => {
    const { html } = await send("{{cancel_url}}", {
      cancel_url: "https://example.test/cancel?token=abc",
    });
    expect(
      hrefs(html).every((h) => h.startsWith("https://example.test/cancel")),
    ).toBe(true);
  });

  test("a variable that holds something else leaves no link and no button", async () => {
    for (const cancel_url of ["javascript:alert(1)", ""]) {
      const { html } = await send("{{cancel_url}}", { cancel_url });
      expect(hrefs(html)).toEqual([]);
      expect(html).toContain("pulsa aquí");
      expect(html).not.toContain("Botón");
      expect(html.toLowerCase()).not.toContain("javascript:");
    }
  });
});
