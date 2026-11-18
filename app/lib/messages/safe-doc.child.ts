import { composeMessageEmail } from "./compose";

/**
 * Run as a separate process by `safe-doc.test.ts`: composing an email from a
 * document whose node types are method names of the renderer's class. If the
 * allow-list is missing, `render` here never returns, which is why this is not
 * in the test's own process: a synchronous loop cannot be timed out from the
 * inside.
 */
const HOSTILE = [
  "render",
  "markup",
  "children",
  "constructor",
  "toString",
  "__proto__",
  "hasOwnProperty",
  "for",
  "foo",
];

for (const type of HOSTILE) {
  const { html } = await composeMessageEmail({
    key: "booking_confirmed",
    locale: "es",
    row: {
      subject: "Asunto",
      preheader: null,
      title: null,
      doc: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Visible" }] },
          { type, content: [] },
        ],
      },
      enabled: true,
    },
    vars: { first_name: "Ana" },
    blocks: {},
  });
  if (!html.includes("Visible")) throw new Error(`${type}: body lost`);
}
console.log("done");
process.exit(0);
