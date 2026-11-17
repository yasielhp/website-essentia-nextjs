import { describe, expect, it } from "bun:test";
import { MAX_DOC_DEPTH, docDepth } from "./doc-depth";

/** A document whose deepest path holds exactly `depth` nodes, root included. */
function nested(depth: number): Record<string, unknown> {
  let node: Record<string, unknown> = { type: "paragraph" };
  for (let level = 3; level <= depth; level += 1) {
    node = { type: "blockquote", content: [node] };
  }
  return depth === 1 ? { type: "doc" } : { type: "doc", content: [node] };
}

describe("docDepth", () => {
  it("counts the root as one level", () => {
    expect(docDepth({ type: "doc" })).toBe(1);
    expect(docDepth({ type: "doc", content: [] })).toBe(1);
    expect(docDepth({ type: "doc", content: [{ type: "paragraph" }] })).toBe(2);
  });

  it("follows the deepest branch, not the first", () => {
    expect(
      docDepth({
        type: "doc",
        content: [
          { type: "paragraph" },
          {
            type: "bulletList",
            content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
          },
        ],
      }),
    ).toBe(4);
  });

  it("is the limit exactly: 30 is the cap, 31 is over it", () => {
    expect(MAX_DOC_DEPTH).toBe(30);
    expect(docDepth(nested(30))).toBe(30);
    expect(docDepth(nested(31))).toBe(31);
  });

  it("measures a very deep document without overflowing the stack", () => {
    expect(docDepth(nested(200_000))).toBe(200_000);
  });

  it("does not trust the shape: odd values count as no children", () => {
    expect(docDepth(null)).toBe(0);
    expect(docDepth("x")).toBe(0);
    expect(docDepth({ type: "doc", content: "x" })).toBe(1);
    expect(docDepth({ type: "doc", content: [null, 3, "x"] })).toBe(1);
  });
});
