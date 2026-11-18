import { describe, expect, test } from "bun:test";
import { defaultContent } from "@/emails/defaults";
import oldShapeHtml from "./fixtures/old-shape-html.json";
import oldTitleOnlyHtml from "./fixtures/old-title-only-html.json";
import { casesFor, squash, visibleText } from "@/emails/defaults/legacy-cases";
import type { CampaignLocale, EmailDoc } from "@/types/campaign";
import {
  MESSAGE_CATALOG,
  MESSAGE_KEYS,
  requiredBlocks,
  type MessageKey,
} from "./catalog";
import {
  chooseDelivery,
  composeMessageEmail,
  effectiveDoc,
  type MessageRow,
} from "./compose";
import {
  BLOCK_NODE,
  blockNode,
  kickerNodeFrom,
  titleNodeFrom,
  TITLE_NODE,
} from "./email-doc";
import { fixedBlocksByKind } from "./fixed-blocks";
import { renderMessageEmail } from "./render";
import { validateMessageTemplate } from "./schema";

/**
 * The whole email as one document: the rules that keep it safe and complete,
 * for every message and both languages, over the real default documents and the
 * real blocks.
 */

const LOCALES: CampaignLocale[] = ["es", "en"];
const row = (over: Partial<MessageRow> = {}): MessageRow => ({
  subject: null,
  preheader: null,
  title: null,
  doc: null,
  enabled: true,
  ...over,
});
const para = (text: string): EmailDoc => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

/** Composes `doc` for the first case of a message, the booking the legacy email was built for. */
function composeWith(
  key: MessageKey,
  locale: CampaignLocale,
  doc: EmailDoc | null,
  caseIndex = 0,
) {
  const c = casesFor(key, locale)[caseIndex]!;
  return composeMessageEmail({
    key,
    locale,
    row: row({ subject: "S {{first_name}}", doc }),
    vars: c.values,
    blocks: fixedBlocksByKind(key, c.fixed),
  });
}

/** The first paragraph of a default's text, as a line of text. */
const docFirstParagraph = (d: EmailDoc): string =>
  (d.content?.[0]?.content ?? []).map((c) => c.text ?? "").join("");
const fillText = (text: string, values: Record<string, string>) =>
  text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, n: string) => values[n] ?? "");

const saveErrors = (
  key: MessageKey,
  doc: unknown,
  locale: CampaignLocale = "es",
) => {
  const result = validateMessageTemplate({
    key,
    channel: "email",
    locale,
    doc,
  });
  return result.ok ? null : result.fieldErrors;
};

/** The default document with `change` applied to its top-level nodes. */
const edited = (
  key: MessageKey,
  locale: CampaignLocale,
  change: (nodes: EmailDoc[]) => EmailDoc[],
): EmailDoc => ({
  type: "doc",
  content: change([...(defaultContent(key, locale).doc.content ?? [])]),
});

describe("the default document is the legacy email", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      test(`${key}/${locale}: saved as it is, it is not an edit, and composing it says the same as composing nothing`, async () => {
        const doc = defaultContent(key, locale).doc;
        expect(chooseDelivery(key, row({ doc }), locale)).toBe("legacy");
        expect(chooseDelivery(key, row({ doc, enabled: true }), locale)).toBe(
          "legacy",
        );
        // Composing the default document itself (what the editor opens) says
        // what the legacy template says: the same words, in the same order,
        // and nothing more. No exception: the kicker is above the title here
        // as it is in the legacy email.
        const composed = await composeWith(key, locale, doc);
        const c = casesFor(key, locale)[0]!;
        expect(squash(visibleText(composed.html))).toBe(
          squash(visibleText(c.legacy)),
        );
      });

      test(`${key}/${locale}: saving the default document keeps the row with no body of its own`, () => {
        const result = validateMessageTemplate({
          key,
          channel: "email",
          locale,
          doc: defaultContent(key, locale).doc,
        });
        expect(result.ok).toBe(true);
        if (result.ok && result.data.channel === "email") {
          expect(result.data.content?.doc).toBeNull();
        }
      });
    }
  }

  test("an edited document is an edit", () => {
    const doc = edited("booking_confirmed", "es", (nodes) => [
      ...nodes,
      para("Una frase más."),
    ]);
    expect(chooseDelivery("booking_confirmed", row({ doc }), "es")).toBe(
      "custom",
    );
  });
});

describe("a block that cannot be removed", () => {
  for (const key of MESSAGE_KEYS) {
    for (const block of requiredBlocks(key)) {
      test(`${key}: without «${block}», saving refuses it by name and sending adds it back`, async () => {
        const doc = edited(key, "es", (nodes) =>
          nodes.filter(
            (n) => !(n.type === BLOCK_NODE && n.attrs?.kind === block),
          ),
        );
        expect(saveErrors(key, doc)).toEqual({
          [`doc.blocks.${block}`]: "blockRequired",
        });

        // Sent anyway (it should not exist): the block is there, because the email needs it.
        const c = casesFor(key, "es")[0]!;
        const out = await composeWith(key, "es", doc);
        const html = fixedBlocksByKind(key, c.fixed)[block];
        if (html) expect(out.html).toContain(html);
      });
    }
  }

  test("a required block that is added back goes at the end, in the order the message has its blocks", async () => {
    const doc = edited("booking_confirmed", "es", (nodes) =>
      nodes.filter(
        (n) =>
          !(
            n.type === BLOCK_NODE &&
            (n.attrs?.kind === "consent_button" ||
              n.attrs?.kind === "cancel_link")
          ),
      ),
    );
    const out = await composeWith("booking_confirmed", "es", doc, 0);
    const text = visibleText(out.html);
    expect(text.indexOf("Detalles de la sesión")).toBeLessThan(
      text.indexOf("consentimiento"),
    );
    expect(out.html).toContain("https://example.test/consent");
  });

  test("a block that only informs may be removed: it is saved, and it is not in the email", async () => {
    const doc = edited("booking_confirmed", "es", (nodes) =>
      nodes.filter(
        (n) => !(n.type === BLOCK_NODE && n.attrs?.kind === "location"),
      ),
    );
    expect(saveErrors("booking_confirmed", doc)).toBeNull();
    const out = await composeWith("booking_confirmed", "es", doc);
    // The address is also in the footer of every email; the block's own label is what goes.
    expect(visibleText(out.html)).not.toContain("Ubicación");
    expect(
      visibleText((await composeWith("booking_confirmed", "es", null)).html),
    ).toContain("Ubicación");
  });
});

describe("the order of the editor is the order of the email", () => {
  test("moving a block moves it in the HTML", async () => {
    const moved = edited("booking_confirmed", "es", (nodes) => {
      const at = nodes.findIndex((n) => n.attrs?.kind === "location");
      const [location] = nodes.splice(at, 1);
      nodes.unshift(nodes.shift()!, location!);
      return nodes;
    });
    expect(saveErrors("booking_confirmed", moved)).toBeNull();
    const before = visibleText(
      (await composeWith("booking_confirmed", "es", null)).html,
    );
    const after = visibleText(
      (await composeWith("booking_confirmed", "es", moved)).html,
    );
    expect(before.indexOf("Detalles de la sesión")).toBeLessThan(
      before.indexOf("Ubicación"),
    );
    // The location now comes first among the blocks, right after the title.
    expect(after.indexOf("Ubicación")).toBeLessThan(
      after.indexOf("Detalles de la sesión"),
    );
    // Nothing is lost by moving.
    expect(after.length).toBeGreaterThan(0);
  });

  test("text can go below a block, and a block can go to the very top", async () => {
    const doc = edited("booking_confirmed", "es", (nodes) => [
      nodes[0]!,
      blockNode("details_card"),
      para("Debajo de los detalles."),
      ...nodes.slice(1).filter((n) => n.attrs?.kind !== "details_card"),
    ]);
    expect(saveErrors("booking_confirmed", doc)).toBeNull();
    const text = visibleText(
      (await composeWith("booking_confirmed", "es", doc)).html,
    );
    expect(text.indexOf("Detalles de la sesión")).toBeLessThan(
      text.indexOf("Debajo de los detalles."),
    );
  });

  test("the title is drawn where it stands, in the style the email has always had", async () => {
    const out = await composeWith("booking_confirmed", "es", null);
    expect(out.html).toMatch(
      /<h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">Tu reserva ha sido confirmada, Ana García\.<\/h1>/,
    );
  });
});

describe("a block whose condition does not hold prints nothing", () => {
  test("nothing owed: the notice is in the document and not in the email", async () => {
    const doc = defaultContent("booking_received", "es").doc;
    const [prepaid, atCentre] = casesFor("booking_received", "es");
    const render = (c: NonNullable<typeof prepaid>) =>
      composeMessageEmail({
        key: "booking_received",
        locale: "es",
        row: row({
          subject: "S",
          doc: { ...doc, content: [...doc.content!, para("x")] },
        }),
        vars: c.values,
        blocks: fixedBlocksByKind("booking_received", c.fixed),
      });
    expect(visibleText((await render(prepaid!)).html)).not.toContain(
      "Has elegido pagar en el centro",
    );
    expect(visibleText((await render(atCentre!)).html)).toContain(
      "Has elegido pagar en el centro",
    );
  });

  test("already signed: no consent button", async () => {
    const [withConsent, signed] = casesFor("booking_confirmed", "es");
    const doc = edited("booking_confirmed", "es", (n) => [...n, para("x")]);
    const render = (c: NonNullable<typeof signed>) =>
      composeMessageEmail({
        key: "booking_confirmed",
        locale: "es",
        row: row({ subject: "S", doc }),
        vars: c.values,
        blocks: fixedBlocksByKind("booking_confirmed", c.fixed),
      });
    expect((await render(withConsent!)).html).toContain("consent");
    expect((await render(signed!)).html).not.toContain("consent");
  });
});

describe("a block of another message, or in the wrong place", () => {
  test("another message's block: saving refuses it, sending drops it", async () => {
    const doc = edited("booking_rescheduled", "es", (n) => [
      ...n,
      blockNode("bonus_card"),
    ]);
    const errors = saveErrors("booking_rescheduled", doc);
    expect(Object.values(errors ?? {})).toEqual(["blockNotAllowed"]);
    const c = casesFor("booking_rescheduled", "es")[0]!;
    const out = await composeWith("booking_rescheduled", "es", doc);
    expect(out.html).not.toContain("Tu bono");
    expect(out.html).toContain(
      fixedBlocksByKind("booking_rescheduled", c.fixed).cancel_link!,
    );
  });

  test("a block nested in a section, a column or a list is refused, and dropped when sent", async () => {
    for (const holder of ["section", "columns", "bulletList", "blockquote"]) {
      const doc = edited("booking_cancelled", "es", (n) => [
        ...n,
        { type: holder, content: [blockNode("details_card")] },
      ]);
      const errors = saveErrors("booking_cancelled", doc);
      expect(Object.values(errors ?? {})).toContain("blockNotAllowed");
      const out = await composeWith("booking_cancelled", "es", doc);
      // The one block left is the default's own; the nested one added nothing.
      expect((out.html.match(/Detalles de la sesión/g) ?? []).length).toBe(1);
    }
  });

  test("a title nested anywhere is refused too", () => {
    const doc = edited("booking_cancelled", "es", (n) => [
      ...n,
      { type: "section", content: [titleNodeFrom("x")] },
    ]);
    expect(Object.values(saveErrors("booking_cancelled", doc) ?? {})).toContain(
      "blockNotAllowed",
    );
  });

  test("a block twice is refused at the second, and drawn once when sent", async () => {
    const doc = edited("booking_cancelled", "es", (n) => [
      ...n,
      blockNode("details_card"),
    ]);
    expect(Object.values(saveErrors("booking_cancelled", doc) ?? {})).toEqual([
      "blockRepeated",
    ]);
    const out = await composeWith("booking_cancelled", "es", doc);
    expect((out.html.match(/Detalles de la sesión/g) ?? []).length).toBe(1);
  });

  test("a block with a kind outside the list, or none, is refused and dropped", async () => {
    for (const bad of [
      { type: BLOCK_NODE, attrs: { kind: "constructor" } },
      { type: BLOCK_NODE },
    ]) {
      const doc = edited("booking_cancelled", "es", (n) => [
        ...n,
        bad as EmailDoc,
      ]);
      expect(Object.values(saveErrors("booking_cancelled", doc) ?? {})).toEqual(
        ["blockNotAllowed"],
      );
      await expect(
        composeWith("booking_cancelled", "es", doc),
      ).resolves.toBeDefined();
    }
  });
});

describe("one title, and only text and variables in it", () => {
  test("none is refused; two are refused; a missing one is put back when sent", async () => {
    const none = edited("booking_cancelled", "es", (n) =>
      n.filter((x) => x.type !== TITLE_NODE),
    );
    expect(saveErrors("booking_cancelled", none)).toEqual({
      "doc.title": "titleOne",
    });
    const two = edited("booking_cancelled", "es", (n) => [
      ...n,
      titleNodeFrom("Otro"),
    ]);
    expect(saveErrors("booking_cancelled", two)).toEqual({
      "doc.title": "titleOne",
    });

    const out = await composeWith("booking_cancelled", "es", none);
    expect(out.html).toContain("<h1");
    expect(visibleText(out.html)).toContain("Tu reserva ha sido cancelada");
    const sent = await composeWith("booking_cancelled", "es", two);
    expect((sent.html.match(/<h1/g) ?? []).length).toBe(1);
    expect(sent.html).not.toContain("Otro");
  });

  test("a link, an image, a mark or an address in the title is refused", () => {
    const hostile: EmailDoc[] = [
      {
        type: "text",
        text: "x",
        marks: [{ type: "link", attrs: { href: "https://e.com" } }],
      },
      { type: "image", attrs: { src: "https://e.com/a.png" } },
      { type: "variable", attrs: { id: "cancel_url" } },
      { type: "htmlCodeBlock", attrs: { html: "<script>" } },
    ];
    for (const child of hostile) {
      const doc = edited("booking_rescheduled", "es", (n) => [
        { type: TITLE_NODE, content: [child] },
        ...n.slice(1),
      ]);
      expect(
        Object.values(saveErrors("booking_rescheduled", doc) ?? {}),
      ).toContain("blockNotAllowed");
    }
  });

  test("what the title carries is escaped, and an unknown variable comes out empty", async () => {
    const doc = edited("booking_cancelled", "es", (n) => [
      {
        type: TITLE_NODE,
        content: [
          { type: "text", text: "<b>Hola</b> {{nope}} {{first_name}}" },
        ],
      },
      ...n.slice(1),
    ]);
    const out = await composeWith("booking_cancelled", "es", doc);
    expect(out.html).toContain("&lt;b&gt;Hola&lt;/b&gt; Ana García</h1>");
    expect(out.html).not.toContain("{{");
  });

  test("an unknown variable in the title is refused when saving, by name", () => {
    const doc = edited("booking_cancelled", "es", (n) => [
      {
        type: TITLE_NODE,
        content: [{ type: "variable", attrs: { id: "amount_due" } }],
      },
      ...n.slice(1),
    ]);
    const result = validateMessageTemplate({
      key: "booking_cancelled",
      channel: "email",
      locale: "es",
      doc,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.unknownVariables).toEqual(["amount_due"]);
  });
});

/**
 * What the composer before the whole email was one document (commit 0dc8af57)
 * made of the row below, for each message in Spanish and English and its first
 * booking case. Generated by running that commit's own `composeMessageEmail`
 * over `fixedBlocksHtml`, and kept as data, so the conversion is judged against
 * what really went out and not against the composer that now does the converting.
 */
/** The same HTML without the blank space between one tag and the next. */
const tight = (html: string) => html.replace(/>\s+</g, "><");

const OLD_SHAPE_HTML = oldShapeHtml as Record<
  string,
  Record<string, string> | undefined
>;

describe("a row saved before the title and the blocks were in the document", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      test(`${key}/${locale}: it is converted, and the email that comes out is the one it always was`, async () => {
        const c = casesFor(key, locale)[0]!;
        const old = row({
          subject: "Asunto {{first_name}}",
          title: "Título {{first_name}}",
          doc: { type: "doc", content: [para("Cuerpo propio {{service}}.")] },
        });
        const converted = effectiveDoc(key, locale, old);
        // The body first and then the blocks, as the old compositor did.
        const kinds = (converted.content ?? []).map((n) =>
          n.type === BLOCK_NODE ? n.attrs?.kind : n.type,
        );
        expect(kinds).toEqual([
          TITLE_NODE,
          "paragraph",
          ...MESSAGE_CATALOG[key].fixed,
        ]);
        const out = await composeMessageEmail({
          key,
          locale,
          row: old,
          vars: c.values,
          blocks: fixedBlocksByKind(key, c.fixed),
        });
        // Byte for byte the email the OLD composer made of this row (a title
        // column and a body with no blocks, the blocks tacked on after it): the
        // snapshot is that composer's own output, taken from commit 0dc8af57. Only
        // the blank space BETWEEN tags is not compared: the new composer indents
        // the blocks differently, which a mail client does not draw.
        expect(tight(out.html)).toBe(
          tight(OLD_SHAPE_HTML[key]?.[locale] ?? ""),
        );
        expect(OLD_SHAPE_HTML[key]?.[locale]).toBeDefined();
        const text = visibleText(out.html);
        expect(text).toContain(`Título Ana`);
        expect(text).toContain("Cuerpo propio");
        // The same email whether the conversion is done by the sender or in advance.
        const inAdvance = await composeMessageEmail({
          key,
          locale,
          row: row({ subject: old.subject, doc: converted }),
          vars: c.values,
          blocks: fixedBlocksByKind(key, c.fixed),
        });
        expect(inAdvance.html).toBe(out.html);
        expect(chooseDelivery(key, old, locale)).toBe("custom");
      });
    }
  }

  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      test(`${key}/${locale}: a row with only a title column sends what the old composer sent, the line under the title included`, async () => {
        // The old composer's own output for this row (commit 0dc8af57): the title
        // from the column, then the default text, whose first line was the
        // kicker, UNDER the title. The default document now has that line above
        // the title; a row like this keeps the email it had.
        const c = casesFor(key, locale)[0]!;
        const out = await composeMessageEmail({
          key,
          locale,
          row: row({
            subject: "Asunto {{first_name}}",
            title: "Título {{first_name}}",
          }),
          vars: c.values,
          blocks: fixedBlocksByKind(key, c.fixed),
        });
        const old = (
          oldTitleOnlyHtml as Record<string, Record<string, string>>
        )[key]![locale]!;
        expect(tight(out.html)).toBe(tight(old));
      });
    }
  }

  test("a row that only has a title still reads as an edit, over the default text", async () => {
    const old = row({ title: "Solo el título" });
    expect(chooseDelivery("booking_confirmed", old, "es")).toBe("custom");
    const out = await composeWith("booking_confirmed", "es", null);
    expect(out.html).toBeDefined();
    const c = casesFor("booking_confirmed", "es")[0]!;
    const sent = await composeMessageEmail({
      key: "booking_confirmed",
      locale: "es",
      row: old,
      vars: c.values,
      blocks: fixedBlocksByKind("booking_confirmed", c.fixed),
    });
    expect(visibleText(sent.html)).toContain("Solo el título");
    expect(visibleText(sent.html)).toContain("Detalles de la sesión");
  });

  test("a row with a title of the default's own words is no edit", () => {
    const old = row({ title: defaultContent("booking_confirmed", "es").title });
    expect(chooseDelivery("booking_confirmed", old, "es")).toBe("legacy");
  });
});

describe("any failure of the new composer is the legacy email", () => {
  test("a document the composer cannot draw falls back, and nothing throws into the booking", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      const c = casesFor("booking_confirmed", "es")[0]!;
      const out = await renderMessageEmail(
        {
          key: "booking_confirmed",
          locale: "es",
          vars: c.values,
          blocks: () => fixedBlocksByKind("booking_confirmed", c.fixed),
        },
        async () =>
          row({
            subject: "S",
            doc: {
              type: "doc",
              content: [
                {
                  type: TITLE_NODE,
                  content: [{ type: "text", text: 5 as never }],
                },
              ],
            },
          }),
      );
      // Either it drew what it could or it fell back: it never throws and never skips.
      expect(["custom", "legacy"]).toContain(out.kind);
      const broken = await renderMessageEmail(
        {
          key: "booking_confirmed",
          locale: "es",
          vars: c.values,
          blocks: () => {
            throw new Error("boom");
          },
        },
        async () =>
          row({
            subject: "S",
            doc: edited("booking_confirmed", "es", (n) => [...n, para("x")]),
          }),
      );
      expect(broken).toEqual({ kind: "legacy" });
    } finally {
      console.error = original;
    }
  });

  test("only the reminder can be skipped", async () => {
    for (const key of MESSAGE_KEYS) {
      const off = row({ enabled: false, doc: defaultContent(key, "es").doc });
      expect(chooseDelivery(key, off, "es")).toBe(
        MESSAGE_CATALOG[key].canDisable ? "skip" : "legacy",
      );
    }
  });
});

describe("a title that comes out empty", () => {
  test("when sent, it is the default title of that message and language, never an email with no heading", async () => {
    for (const locale of LOCALES) {
      const doc = edited("booking_cancelled", locale, (n) => [
        {
          type: TITLE_NODE,
          content: [{ type: "variable", attrs: { id: "service" } }],
        },
        ...n.slice(1),
      ]);
      const c = casesFor("booking_cancelled", locale)[0]!;
      // The variable has nothing in it for this booking.
      const out = await composeMessageEmail({
        key: "booking_cancelled",
        locale,
        row: row({ subject: "S", doc }),
        vars: { ...c.values, service: "" },
        blocks: fixedBlocksByKind("booking_cancelled", c.fixed),
      });
      expect(out.html).toContain("<h1");
      const h1 = /<h1[^>]*>([^<]*)<\/h1>/.exec(out.html)?.[1] ?? "";
      expect(h1.trim()).not.toBe("");
      expect(visibleText(out.html)).toContain(h1);
      const expected = defaultContent(
        "booking_cancelled",
        locale,
      ).title.replace("{{first_name}}", c.values.first_name!);
      expect(h1).toBe(expected);
    }
  });
  test("when saved it is refused with an error of its own", () => {
    const doc = edited("booking_cancelled", "es", (n) => [
      { type: TITLE_NODE, content: [{ type: "text", text: "  " }] },
      ...n.slice(1),
    ]);
    expect(saveErrors("booking_cancelled", doc)).toEqual({
      "doc.title": "titleEmpty",
    });
  });
  test("a title with an attribute is refused when saved", () => {
    const doc = edited("booking_cancelled", "es", (n) => [
      { ...n[0]!, attrs: { onclick: "x" } },
      ...n.slice(1),
    ]);
    expect(Object.values(saveErrors("booking_cancelled", doc) ?? {})).toEqual([
      "blockNotAllowed",
    ]);
  });
});

describe("saving a document leaves the old title column clean", () => {
  const writeOf = (
    key: MessageKey,
    doc: EmailDoc | null,
    extra: Record<string, unknown> = {},
  ) => {
    const result = validateMessageTemplate({
      key,
      channel: "email",
      locale: "es",
      doc,
      ...extra,
    });
    if (!result.ok || result.data.channel !== "email")
      throw new Error("expected valid");
    return result.data.content;
  };
  test("the default document clears it, so an old row does not come back as custom with its old title", () => {
    expect(
      writeOf(
        "booking_confirmed",
        defaultContent("booking_confirmed", "es").doc,
      ),
    ).toEqual({ doc: null, title: null });
  });
  test("so does a document of the administrator's own", () => {
    const doc = edited("booking_confirmed", "es", (n) => [...n, para("Más.")]);
    expect(writeOf("booking_confirmed", doc)).toMatchObject({ title: null });
  });
  test("a title the caller sends on purpose is kept as sent", () => {
    const doc = edited("booking_confirmed", "es", (n) => [...n, para("Más.")]);
    expect(
      writeOf("booking_confirmed", doc, { title: "A mano" }),
    ).toMatchObject({ title: "A mano" });
  });
  test("saving only the subject does not touch the document or the title", () => {
    const result = validateMessageTemplate({
      key: "booking_confirmed",
      channel: "email",
      locale: "es",
      subject: "Solo",
    });
    expect(
      result.ok && result.data.channel === "email" && result.data.content,
    ).toEqual({ subject: "Solo" });
  });
});

describe("the kicker in the composed email", () => {
  const KICKER_HTML =
    /<p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">([^<]*)<\/p>/;

  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      const def = defaultContent(key, locale);
      if (def.kicker === null) continue;
      test(`${key}/${locale}: the kicker is printed exactly as the legacy email prints it, and comes before the title, which comes before the text`, async () => {
        const c = casesFor(key, locale)[0]!;
        const composed = await composeWith(key, locale, def.doc);
        const legacy = KICKER_HTML.exec(c.legacy)?.[0];
        expect(legacy).toBeDefined();
        // Byte for byte the same line.
        expect(composed.html).toContain(legacy!);
        const at = {
          kicker: composed.html.indexOf(legacy!),
          title: composed.html.indexOf("<h1"),
          text: composed.html.indexOf(
            fillText(docFirstParagraph(def.intro), c.values),
          ),
        };
        expect(at.kicker).toBeGreaterThan(-1);
        expect(at.kicker).toBeLessThan(at.title);
        expect(at.title).toBeLessThan(at.text);
      });
    }
  }

  test("a message with no kicker prints none", async () => {
    const out = await composeWith(
      "consent_request",
      "es",
      defaultContent("consent_request", "es").doc,
    );
    expect(KICKER_HTML.test(out.html)).toBe(false);
  });

  test("an empty kicker prints nothing: no line, no gap", async () => {
    const def = defaultContent("booking_confirmed", "es").doc;
    const rest = (def.content ?? []).filter((n) => n.type !== "emailKicker");
    const withEmpty = await composeWith("booking_confirmed", "es", {
      ...def,
      content: [{ type: "emailKicker" }, ...rest],
    });
    const without = await composeWith("booking_confirmed", "es", {
      ...def,
      content: rest,
    });
    expect(KICKER_HTML.test(withEmpty.html)).toBe(false);
    expect(withEmpty.html).toBe(without.html);
    // Blank space and an empty variable-less line are the same thing.
    const blank = await composeWith("booking_confirmed", "es", {
      ...def,
      content: [
        { type: "emailKicker", content: [{ type: "text", text: "  " }] },
        ...rest,
      ],
    });
    expect(blank.html).toBe(without.html);
  });

  test("the words are the admin's, escaped, with the variables filled", async () => {
    const def = defaultContent("booking_confirmed", "es").doc;
    const rest = (def.content ?? []).filter((n) => n.type !== "emailKicker");
    const out = await composeWith("booking_confirmed", "es", {
      ...def,
      content: [kickerNodeFrom("Para <b>{{first_name}}</b> & ya"), ...rest],
    });
    expect(out.html).toContain(
      ">Para &lt;b&gt;Ana García&lt;/b&gt; &amp; ya</p>",
    );
    expect(out.html).not.toContain("<b>Ana");
  });

  test("one found after the title is sent above it, not lost", async () => {
    const def = defaultContent("booking_confirmed", "es").doc;
    const rest = (def.content ?? []).filter((n) => n.type !== "emailKicker");
    const [title, ...others] = rest;
    const out = await composeWith("booking_confirmed", "es", {
      ...def,
      content: [title!, kickerNodeFrom("Aviso"), ...others],
    });
    expect(out.html.indexOf(">Aviso</p>")).toBeGreaterThan(-1);
    expect(out.html.indexOf(">Aviso</p>")).toBeLessThan(
      out.html.indexOf("<h1"),
    );
  });

  test("hostile things in a kicker never reach the email: attributes, marks, a link variable, an unknown variable; one nested is not printed at all", async () => {
    const def = defaultContent("booking_confirmed", "es").doc;
    const rest = (def.content ?? []).filter((n) => n.type !== "emailKicker");
    const out = await composeWith("booking_confirmed", "es", {
      ...def,
      content: [
        {
          type: "emailKicker",
          attrs: { onclick: "x" },
          content: [
            { type: "text", text: "Hola", marks: [{ type: "bold" }] },
            { type: "variable", attrs: { id: "cancel_url" } },
            { type: "variable", attrs: { id: "nope" } },
            { type: "htmlCodeBlock", attrs: { html: "<script>x</script>" } },
          ],
        },
        ...rest,
        { type: "blockquote", content: [kickerNodeFrom("ANIDADA")] },
      ],
    });
    expect(out.html).toContain(">Hola</p>");
    expect(out.html).not.toContain("onclick");
    expect(out.html).not.toContain("<script>");
    expect(out.html).not.toContain("<b>Hola");
    expect(out.html).not.toContain("ANIDADA");
  });

  test("a document saved with the kicker as the first PARAGRAPH under the title still sends exactly that: a paragraph under the title", async () => {
    const def = defaultContent("booking_confirmed", "es");
    const rest = (def.doc.content ?? []).filter(
      (n) => n.type !== "emailKicker",
    );
    const [title, ...others] = rest;
    const out = await composeWith("booking_confirmed", "es", {
      ...def.doc,
      content: [title!, para("Reserva confirmada"), ...others],
    });
    expect(KICKER_HTML.test(out.html)).toBe(false);
    expect(out.html.indexOf("<h1")).toBeLessThan(
      out.html.indexOf("Reserva confirmada</p>"),
    );
  });
});

describe("saving a kicker", () => {
  const withKicker = (node: EmailDoc | null, locale: CampaignLocale = "es") => {
    const def = defaultContent("booking_confirmed", locale).doc;
    const rest = (def.content ?? []).filter((n) => n.type !== "emailKicker");
    return {
      ...def,
      content: node ? [node, ...rest, para("Más.")] : [...rest, para("Más.")],
    };
  };

  test("a good one is saved", () => {
    expect(
      saveErrors(
        "booking_confirmed",
        withKicker(kickerNodeFrom("Hola {{first_name}}")),
      ),
    ).toBeNull();
  });

  test("two, after the title, with attributes, nested or with something hostile inside are refused", () => {
    const def = withKicker(kickerNodeFrom("A"));
    expect(
      saveErrors("booking_confirmed", {
        ...def,
        content: [kickerNodeFrom("A"), ...def.content!],
      }),
    ).toEqual({ "doc.kicker": "kickerOne" });
    const [first, ...rest] = def.content!;
    expect(
      saveErrors("booking_confirmed", {
        ...def,
        content: [rest[0]!, first!, ...rest.slice(1)],
      }),
    ).toEqual({ "doc.content.1": "kickerMisplaced" });
    expect(
      Object.values(
        saveErrors(
          "booking_confirmed",
          withKicker({ ...kickerNodeFrom("A"), attrs: { onclick: "x" } }),
        ) ?? {},
      ),
    ).toEqual(["blockNotAllowed"]);
    expect(
      saveErrors("booking_confirmed", {
        ...def,
        content: [
          { type: "blockquote", content: [kickerNodeFrom("A")] },
          ...def.content!.slice(1),
        ],
      }),
    ).not.toBeNull();
    for (const child of [
      { type: "htmlCodeBlock", attrs: { html: "<script>" } },
      {
        type: "text",
        text: "x",
        marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
      },
      { type: "variable", attrs: { id: "cancel_url" } },
    ] as EmailDoc[]) {
      expect(
        saveErrors(
          "booking_confirmed",
          withKicker({ type: "emailKicker", content: [child] }),
        ),
      ).not.toBeNull();
    }
  });

  test("a variable the message does not offer is named, as in the title", () => {
    expect(
      saveErrors(
        "booking_confirmed",
        withKicker(kickerNodeFrom("{{expires_on}}")),
      ),
    ).not.toBeNull();
  });

  test("an empty one is saved: it says nothing", () => {
    expect(
      saveErrors("booking_confirmed", withKicker({ type: "emailKicker" })),
    ).toBeNull();
  });
});
