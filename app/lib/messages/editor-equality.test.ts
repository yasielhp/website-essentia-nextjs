import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { MailyKit, VariableExtension } from "@maily-to/core/extensions";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { defaultContent } from "@/emails/defaults";
import type { EmailDoc } from "@/types/campaign";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "./catalog";
import { chooseDelivery } from "./compose";
import { docKicker, docTitle, withKickerSlot } from "./email-doc";
import { editableLocales, sameDoc } from "./editor-state";
import { validateMessageTemplate } from "./schema";
import {
  EmailDocGuard,
  EmailKickerNode,
  EmailTitleNode,
  SystemBlockNode,
} from "../../(dashboard)/dashboard/messages/email/email-nodes";

/**
 * The editor does not give back the document it was given: it fills in the
 * attributes it has defaults for (a paragraph's text direction, a variable's
 * `required`). If a document that says the same thing as the default compared
 * as different, writing a letter and deleting it would turn the message into the
 * administrator's own. These tests put the 16 default documents through the REAL
 * schema of the editor (Maily's kit, its variable node, and the title and block
 * nodes) and ask whether what comes out is still the default.
 */

const schema = getSchema([
  MailyKit,
  VariableExtension,
  EmailKickerNode,
  EmailTitleNode,
  SystemBlockNode,
  EmailDocGuard,
]);
const LOCALES = ["es", "en"] as const;
const reemit = (doc: EmailDoc) => schema.nodeFromJSON(doc).toJSON() as EmailDoc;

describe("what the editor gives back is the default", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      test(`${key}/${locale}: the document as the editor re-emits it is the same document`, () => {
        const def = defaultContent(key, locale).doc;
        const out = reemit(def);
        // It really is re-emitted with more in it...
        expect(JSON.stringify(out)).not.toBe(JSON.stringify(def));
        // ...and none of it is a change.
        expect(sameDoc(out, def)).toBe(true);
        expect(sameDoc(def, out)).toBe(true);
      });

      test(`${key}/${locale}: writing a letter and deleting it leaves no change`, () => {
        const def = defaultContent(key, locale).doc;
        let state = EditorState.create({ doc: schema.nodeFromJSON(def) });
        // Inside the first paragraph after the title.
        let at = 0;
        state.doc.forEach((node, offset) => {
          if (at === 0 && node.type.name === "paragraph") at = offset + 1;
        });
        state = state.apply(state.tr.insertText("x", at));
        expect(sameDoc(state.doc.toJSON() as EmailDoc, def)).toBe(false);
        state = state.apply(
          state.tr
            .setSelection(TextSelection.create(state.doc, at + 1))
            .delete(at, at + 1),
        );
        expect(sameDoc(state.doc.toJSON() as EmailDoc, def)).toBe(true);
      });

      test(`${key}/${locale}: taking a block out and putting it back where it was leaves no change`, () => {
        const def = defaultContent(key, locale).doc;
        let state = EditorState.create({ doc: schema.nodeFromJSON(def) });
        let from = -1;
        let node = state.doc.firstChild!;
        state.doc.forEach((n, offset) => {
          if (from === -1 && n.type.name === "systemBlock") {
            from = offset;
            node = n;
          }
        });
        state = state.apply(state.tr.delete(from, from + node.nodeSize));
        expect(sameDoc(state.doc.toJSON() as EmailDoc, def)).toBe(false);
        state = state.apply(state.tr.insert(from, node));
        expect(sameDoc(state.doc.toJSON() as EmailDoc, def)).toBe(true);
      });
    }
  }

  test("a real change is still a change", () => {
    const def = defaultContent("booking_confirmed", "es").doc;
    const edited: EmailDoc = {
      ...def,
      content: (def.content ?? []).map((n, i) =>
        i === 1
          ? {
              type: "paragraph",
              content: [{ type: "text", text: "Otra frase." }],
            }
          : n,
      ),
    };
    expect(sameDoc(reemit(edited), def)).toBe(false);
    // A variable that is optional is not the default's required one.
    const optional: EmailDoc = {
      ...def,
      content: (def.content ?? []).map((n) =>
        n.type === "emailTitle"
          ? {
              ...n,
              content: (n.content ?? []).map((c) =>
                c.type === "variable"
                  ? { ...c, attrs: { ...c.attrs, required: false } }
                  : c,
              ),
            }
          : n,
      ),
    };
    expect(sameDoc(reemit(optional), def)).toBe(false);
    // A different text direction is a real choice.
    const rtl: EmailDoc = {
      ...def,
      content: (def.content ?? []).map((n, i) =>
        i === 1
          ? {
              ...reemit({ type: "doc", content: [n] }).content![0]!,
              attrs: { textDirection: "rtl" },
            }
          : n,
      ),
    };
    expect(sameDoc(rtl, def)).toBe(false);
  });

  test("moving a block, or a paragraph above a block, is a change", () => {
    const def = defaultContent("booking_confirmed", "es").doc;
    const nodes = [...(def.content ?? [])];
    const swapped = {
      ...def,
      content: [
        nodes[0]!,
        nodes[3]!,
        nodes[2]!,
        ...nodes.slice(1, 2),
        ...nodes.slice(4),
      ],
    };
    expect(sameDoc(reemit(swapped), def)).toBe(false);
  });
});

describe("the server decides it the same way", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      test(`${key}/${locale}: the document as the editor re-emits it is not an edit: saved, the row keeps no body; sent, it is the legacy email`, () => {
        const doc = reemit(defaultContent(key, locale).doc);
        const result = validateMessageTemplate({
          key,
          channel: "email",
          locale,
          doc,
        });
        expect(result.ok).toBe(true);
        if (result.ok && result.data.channel === "email") {
          expect(result.data.content?.doc).toBeNull();
        }
        expect(
          chooseDelivery(
            key,
            { subject: null, preheader: null, title: null, doc, enabled: true },
            locale,
          ),
        ).toBe("legacy");
      });
    }
  }
});

describe("every title the editor opens has text to show", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of editableLocales(key)) {
      test(`${key}/${locale}: the title, as the editor re-emits it, has words of its own, and a value for its variables`, () => {
        const doc = reemit(defaultContent(key, locale).doc);
        const title = docTitle(doc);
        expect(title?.type).toBe("emailTitle");
        const children = title?.content ?? [];
        const words = children
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join("")
          .trim();
        // Not only a variable: there is text a person can read in it.
        expect(words.length).toBeGreaterThan(3);
        // And the variable in it is one the message offers, so it is a chip with a name.
        for (const c of children.filter((c) => c.type === "variable")) {
          expect(MESSAGE_CATALOG[key].variables as readonly string[]).toContain(
            String(c.attrs?.id),
          );
        }
      });
    }
  }
});

describe("the kicker slot is no change", () => {
  for (const key of MESSAGE_KEYS) {
    for (const locale of LOCALES) {
      test(`${key}/${locale}: the default with the editor's empty kicker in front of it is still the default`, () => {
        const def = defaultContent(key, locale).doc;
        const slot = reemit(withKickerSlot(def));
        expect(sameDoc(slot, def)).toBe(true);
        expect(sameDoc(def, slot)).toBe(true);
        // And one that has its own text is not the same as one that has none.
        const changed = {
          ...slot,
          content: [
            { type: "emailKicker", content: [{ type: "text", text: "Otra" }] },
            ...(slot.content ?? []).filter((n) => n.type !== "emailKicker"),
          ],
        } as EmailDoc;
        expect(sameDoc(changed, def)).toBe(false);
      });
    }
  }

  test("a kicker of the default, emptied, is a change; written again the same, it is not", () => {
    const def = defaultContent("booking_confirmed", "es").doc;
    const kicker = docKicker(def)!;
    const rest = (def.content ?? []).filter((n) => n.type !== "emailKicker");
    expect(
      sameDoc({ ...def, content: [{ type: "emailKicker" }, ...rest] }, def),
    ).toBe(false);
    expect(
      sameDoc(
        {
          ...def,
          content: [
            reemit({ type: "doc", content: [kicker] }).content![0]!,
            ...rest,
          ],
        },
        def,
      ),
    ).toBe(true);
  });

  test("the server decides it the same way: the default with the empty slot is not an edit", () => {
    for (const key of MESSAGE_KEYS) {
      for (const locale of LOCALES) {
        const doc = reemit(withKickerSlot(defaultContent(key, locale).doc));
        const result = validateMessageTemplate({
          key,
          channel: "email",
          locale,
          doc,
        });
        expect(result.ok).toBe(true);
        if (result.ok && result.data.channel === "email") {
          expect(result.data.content?.doc).toBeNull();
        }
      }
    }
  });
});
