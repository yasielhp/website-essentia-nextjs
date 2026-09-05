import { describe, expect, it } from "bun:test";
import { blocksToDoc, docIsEmpty, inlineToNodes } from "./doc";

describe("inlineToNodes", () => {
  it("marks bold and https links, leaves the rest as text", () => {
    const nodes = inlineToNodes(
      "Hola **{{first_name}}**, mira [esto](https://a.test/x) hoy",
    );
    expect(nodes).toEqual([
      { type: "text", text: "Hola " },
      { type: "text", text: "{{first_name}}", marks: [{ type: "bold" }] },
      { type: "text", text: ", mira " },
      {
        type: "text",
        text: "esto",
        marks: [
          {
            type: "link",
            attrs: { href: "https://a.test/x", target: "_blank" },
          },
        ],
      },
      { type: "text", text: " hoy" },
    ]);
  });

  it("leaves non-https links as plain text", () => {
    expect(inlineToNodes("[x](http://a.test)")).toEqual([
      { type: "text", text: "[x](http://a.test)" },
    ]);
  });
});

describe("blocksToDoc", () => {
  it("turns each block into its Maily node", () => {
    const doc = blocksToDoc([
      { type: "heading", text: "Título" },
      { type: "paragraph", text: "Uno\n\nDos\nlínea" },
      { type: "image", url: "https://a.test/i.png", alt: "Sala" },
      { type: "image", url: "", alt: "" },
      { type: "button", text: "Reservar", url: "https://a.test/r" },
      { type: "divider" },
    ]);
    expect(doc.content?.map((n) => n.type)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
      "image",
      "button",
      "horizontalRule",
    ]);
    expect(doc.content?.[2]?.content?.map((n) => n.type)).toEqual([
      "text",
      "hardBreak",
      "text",
    ]);
    expect(doc.content?.[4]?.attrs).toMatchObject({
      text: "Reservar",
      url: "https://a.test/r",
      buttonColor: "#103838",
    });
  });
});

describe("docIsEmpty", () => {
  it("is empty for null, no content, or only blank paragraphs", () => {
    expect(docIsEmpty(null)).toBe(true);
    expect(docIsEmpty({ type: "doc", content: [] })).toBe(true);
    expect(
      docIsEmpty({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "  " }] },
        ],
      }),
    ).toBe(true);
  });

  it("is not empty with text, a variable or any other node", () => {
    expect(
      docIsEmpty({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "a" }] },
        ],
      }),
    ).toBe(false);
    expect(
      docIsEmpty({ type: "doc", content: [{ type: "horizontalRule" }] }),
    ).toBe(false);
  });
});
