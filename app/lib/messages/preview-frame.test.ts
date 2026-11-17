import { describe, expect, it } from "bun:test";
import { previewSrcDoc } from "./preview-frame";

const page = (links = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><title>x</title></head><body><p>Hola</p>${links}</body></html>`;

describe("previewSrcDoc", () => {
  it("sends every link to a new window, so a click never navigates the frame", () => {
    const out = previewSrcDoc(page());
    expect(out).toContain('<base target="_blank">');
    expect(out.indexOf("<base")).toBeLessThan(out.indexOf("</head>"));
  });

  it("puts the base where the head begins, before any link or style is read", () => {
    const out = previewSrcDoc(page());
    expect(out.indexOf("<base")).toBeLessThan(out.indexOf("<meta"));
  });

  it("gives each link a safe rel", () => {
    const out = previewSrcDoc(
      page(
        '<a href="https://example.com/a">a</a><a href="https://example.com/b" class="x">b</a>',
      ),
    );
    const anchors = out.match(/<a [^>]*>/g) ?? [];
    expect(anchors).toHaveLength(2);
    for (const anchor of anchors) {
      expect(anchor).toContain('rel="noopener noreferrer"');
    }
  });

  it("replaces a rel the email already had instead of doubling it", () => {
    const out = previewSrcDoc(
      page('<a href="https://x.test" rel="nofollow">a</a>'),
    );
    expect(out.match(/rel=/g)).toHaveLength(1);
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("a target of the email's own is overridden too", () => {
    const out = previewSrcDoc(
      page('<a href="https://x.test" target="_self">a</a>'),
    );
    expect(out).toContain('target="_blank"');
    expect(out).not.toContain('target="_self"');
  });

  it("leaves the rest of the email as it was", () => {
    const html = page('<a href="https://x.test">a</a>');
    const out = previewSrcDoc(html);
    expect(out).toContain("<p>Hola</p>");
    expect(out).toContain('href="https://x.test"');
  });

  it("html without a head still gets the base", () => {
    const out = previewSrcDoc("<p>Hola</p>");
    expect(out.startsWith('<base target="_blank">')).toBe(true);
  });

  it("is not fooled by a word that merely starts with a", () => {
    const out = previewSrcDoc(
      '<p>Hola</p><address>x</address><abbr title="t">y</abbr>',
    );
    expect(out).not.toContain("rel=");
  });
});
