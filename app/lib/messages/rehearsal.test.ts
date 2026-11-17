import { describe, expect, it } from "bun:test";
import type { EmailDoc } from "@/types/campaign";
import { MESSAGE_KEYS } from "./catalog";
import { rehearseRender } from "./rehearsal";
import { validateMessageTemplate } from "./schema";

const para = (value: string): EmailDoc => ({
  type: "paragraph",
  content: [{ type: "text", text: value }],
});
const doc = (...nodes: EmailDoc[]): EmailDoc => ({
  type: "doc",
  content: nodes,
});

describe("rehearseRender", () => {
  it("passes a body that renders", async () => {
    expect(
      await rehearseRender("booking_confirmed", "es", {
        subject: "Hola {{first_name}}",
        doc: doc(para("Te esperamos el {{date}}.")),
      }),
    ).toBe("ok");
  });

  it("passes every message and language with its default body", async () => {
    for (const key of MESSAGE_KEYS) {
      for (const locale of ["en", "es"] as const) {
        expect(await rehearseRender(key, locale, { subject: "Hola" })).toBe(
          "ok",
        );
      }
    }
  });

  it("passes a content that only clears fields", async () => {
    expect(
      await rehearseRender("booking_reminder", "es", {
        doc: null,
        title: null,
      }),
    ).toBe("ok");
  });

  it("refuses a heading the renderer throws on", async () => {
    expect(
      await rehearseRender("booking_confirmed", "es", {
        doc: doc({
          type: "heading",
          attrs: { level: 99 },
          content: [{ type: "text", text: "x" }],
        }),
      }),
    ).toBe("docNotRenderable");
  });

  it("a node type the renderer does not know is never saved: the validator or the trial refuses it", async () => {
    // Which of the two catches it depends on the sanitiser: with an allow-list
    // the validator does (and the trial would see a document with the node
    // taken out); without one the trial does (the renderer throws). Either
    // way it does not get through both.
    const content = {
      doc: doc({ type: "bogusNode", content: [{ type: "text", text: "x" }] }),
    };
    const validation = validateMessageTemplate({
      key: "booking_confirmed",
      channel: "email",
      locale: "es",
      ...content,
    });
    const refused =
      !validation.ok ||
      (await rehearseRender("booking_confirmed", "es", content)) !== "ok";
    expect(refused).toBe(true);
  });

  it("refuses a render that comes back empty", async () => {
    const empty = async () => ({ subject: "Hola", html: "  " });
    const noSubject = async () => ({ subject: "", html: "<p>x</p>" });
    expect(await rehearseRender("booking_confirmed", "es", {}, empty)).toBe(
      "docNotRenderable",
    );
    expect(await rehearseRender("booking_confirmed", "es", {}, noSubject)).toBe(
      "docNotRenderable",
    );
  });

  it("uses the sample data of the message it is for", async () => {
    // A variable the message offers renders; the trial must not fail on it.
    expect(
      await rehearseRender("consent_request", "en", {
        doc: doc(para("Hello {{first_name}}")),
      }),
    ).toBe("ok");
  });
});
