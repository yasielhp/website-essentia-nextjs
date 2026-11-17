import { describe, expect, test } from "bun:test";
import { renderBodyFragment } from "@/emails/templates/campaign";
import { renderVariables } from "@/lib/campaigns/body-html";
import type { EmailDoc } from "@/types/campaign";
import { findForbiddenNodes, sanitizeDoc } from "./safe-doc";

/**
 * Everything here goes through the real Maily renderer, the way an email is
 * built: the document is sanitised with the values the render will use, then
 * rendered with the same values, then the plain `{{tokens}}` are filled. What
 * counts is the HTML that comes out.
 */

const doc = (...content: EmailDoc[]): EmailDoc => ({ type: "doc", content });
const text = (t: string, marks?: EmailDoc["marks"]): EmailDoc => ({
  type: "text",
  text: t,
  marks,
});
const p = (...content: EmailDoc[]): EmailDoc => ({
  type: "paragraph",
  content,
});

async function html(d: EmailDoc, values: Record<string, string> = {}) {
  const fragment = await renderBodyFragment(sanitizeDoc(d, values), values);
  return renderVariables(fragment, values);
}

/** Every URL-bearing attribute of the output. */
const urls = (out: string) =>
  [...out.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) =>
    m[1]!.replace(/&amp;/g, "&"),
  );

const HOSTILE = [
  "javascript:alert(1)",
  " JaVaScRiPt:alert(1)",
  "java\nscript:alert(1)",
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
  "//evil.example/x",
  "/relative/path",
  "ftp://example.test/x",
  "",
];

const link = (href: string, extra: Record<string, unknown> = {}) =>
  p(
    text("pulsa", [
      { type: "link", attrs: { href, target: "_blank", ...extra } },
    ]),
  );
const button = (url: string, extra: Record<string, unknown> = {}) => ({
  type: "button",
  attrs: {
    text: "Botón",
    url,
    alignment: "center",
    variant: "filled",
    borderRadius: "round",
    buttonColor: "#103838",
    textColor: "#f0ede6",
    ...extra,
  },
});

describe("a link that is a variable", () => {
  // `https://first_name`: Maily writes the variable's VALUE into the href.
  for (const bad of HOSTILE) {
    test(`link, value ${JSON.stringify(bad)} ends in #`, async () => {
      const out = await html(
        link("https://first_name", { isUrlVariable: true }),
        {
          first_name: bad,
        },
      );
      expect(urls(out)).toEqual(["#"]);
    });

    test(`button, value ${JSON.stringify(bad)} ends in #`, async () => {
      const out = await html(
        doc(button("https://first_name", { isUrlVariable: true })),
        { first_name: bad },
      );
      expect(urls(out)).toEqual(["#"]);
    });
  }

  test("a safe value is used, and Maily does not substitute it a second time", async () => {
    const values = { first_name: "https://example.test/a?b=1&c=2" };
    const out = await html(
      link("https://first_name", { isUrlVariable: true }),
      values,
    );
    expect(urls(out)).toEqual(["https://example.test/a?b=1&c=2"]);
    const btn = await html(
      doc(button("https://first_name", { isUrlVariable: true })),
      values,
    );
    expect(urls(btn)).toEqual(["https://example.test/a?b=1&c=2"]);
  });

  test("mailto: is allowed", async () => {
    const out = await html(
      link("https://first_name", { isUrlVariable: true }),
      {
        first_name: "mailto:info@example.test",
      },
    );
    expect(urls(out)).toEqual(["mailto:info@example.test"]);
  });

  test("a variable nobody provided ends in #, not in a relative address", async () => {
    const out = await html(link("https://nope", { isUrlVariable: true }), {});
    expect(urls(out)).toEqual(["#"]);
  });

  test("a name the object prototype owns is not a variable", async () => {
    for (const name of [
      "constructor",
      "__proto__",
      "toString",
      "hasOwnProperty",
    ]) {
      const out = await html(
        link(`https://${name}`, { isUrlVariable: true }),
        {},
      );
      expect(urls(out)).toEqual(["#"]);
    }
  });

  test("the document passed in is not changed", () => {
    const original = link("https://first_name", { isUrlVariable: true });
    const copy = JSON.stringify(original);
    sanitizeDoc(doc(original), { first_name: "javascript:alert(1)" });
    expect(JSON.stringify(original)).toBe(copy);
  });
});

describe("a literal address", () => {
  for (const bad of HOSTILE) {
    test(`${JSON.stringify(bad)} in a link and a button ends in #`, async () => {
      const out = await html(doc(link(bad), button(bad)));
      expect(urls(out)).toEqual(["#", "#"]);
    });
  }

  test("a token in an address is filled and then judged", async () => {
    const good = await html(link("{{cancel_url}}"), {
      cancel_url: "https://example.test/c?t=1",
    });
    expect(urls(good)).toEqual(["https://example.test/c?t=1"]);
    const bad = await html(link("{{cancel_url}}"), {
      cancel_url: "javascript:alert(1)",
    });
    expect(urls(bad)).toEqual(["#"]);
  });
});

describe("images and link cards", () => {
  const image = (attrs: Record<string, unknown>): EmailDoc => ({
    type: "image",
    attrs: { alt: "x", width: 100, alignment: "center", ...attrs },
  });
  const inline = (attrs: Record<string, unknown>): EmailDoc => ({
    type: "inlineImage",
    attrs: { alt: "x", ...attrs },
  });
  const card = (attrs: Record<string, unknown>): EmailDoc => ({
    type: "linkCard",
    attrs: { title: "Tarjeta", description: "d", linkTitle: "ver", ...attrs },
  });

  for (const bad of [
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "ftp://x/y.png",
    "",
  ]) {
    test(`image with src ${JSON.stringify(bad)} is removed`, async () => {
      const out = await html(doc(image({ src: bad }), p(text("sigue"))));
      expect(out).not.toContain("<img");
      expect(out).toContain("sigue");
    });
    test(`inlineImage with src ${JSON.stringify(bad)} is removed`, async () => {
      const out = await html(doc(p(inline({ src: bad }), text("sigue"))));
      expect(out).not.toContain("<img");
    });
    test(`a variable image whose value is ${JSON.stringify(bad)} is removed`, async () => {
      const out = await html(
        doc(
          image({ src: "https://photo", isSrcVariable: true }),
          p(inline({ src: "https://photo", isSrcVariable: true })),
        ),
        { photo: bad },
      );
      expect(out).not.toContain("<img");
    });
  }

  test("an image keeps a safe src and drops a bad link around it", async () => {
    const out = await html(
      doc(
        image({
          src: "https://example.test/a.png",
          externalLink: "javascript:alert(1)",
        }),
        p(
          inline({
            src: "https://example.test/b.png",
            externalLink: "javascript:alert(1)",
          }),
        ),
      ),
    );
    expect(urls(out)).toEqual([
      "https://example.test/a.png",
      "https://example.test/b.png",
    ]);
  });

  test("an image's variable link resolves and is judged", async () => {
    const bad = await html(
      doc(
        image({
          src: "https://example.test/a.png",
          externalLink: "https://where",
          isExternalLinkVariable: true,
        }),
      ),
      { where: "javascript:alert(1)" },
    );
    expect(urls(bad)).toEqual(["https://example.test/a.png"]);
    const good = await html(
      doc(
        image({
          src: "https://example.test/a.png",
          externalLink: "https://where",
          isExternalLinkVariable: true,
        }),
      ),
      { where: "https://example.test/dest" },
    );
    expect(urls(good)).toEqual([
      "https://example.test/dest",
      "https://example.test/a.png",
    ]);
  });

  test("a logo with a bad src is removed", async () => {
    const out = await html(
      doc({ type: "logo", attrs: { src: "javascript:alert(1)", size: "md" } }),
    );
    expect(out).not.toContain("<img");
  });

  for (const bad of ["javascript:alert(1)", "data:text/html,x", "vbscript:x"]) {
    test(`a link card to ${JSON.stringify(bad)} goes to #`, async () => {
      const out = await html(doc(card({ link: bad })));
      for (const href of urls(out)) expect(href).toBe("#");
    });
  }

  test("a link card named after a variable takes its value, judged", async () => {
    const bad = await html(doc(card({ link: "where" })), {
      where: "javascript:alert(1)",
    });
    for (const href of urls(bad)) expect(href).toBe("#");
    const good = await html(doc(card({ link: "where" })), {
      where: "https://example.test/d",
    });
    expect(urls(good).every((h) => h === "https://example.test/d")).toBe(true);
  });

  test("a link card's picture must be https or http", async () => {
    const out = await html(
      doc(
        card({ link: "https://example.test/", image: "javascript:alert(1)" }),
      ),
    );
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<img");
  });
});

describe("raw HTML", () => {
  const htmlBlock = (...content: EmailDoc[]): EmailDoc => ({
    type: "htmlCodeBlock",
    attrs: { language: "html" },
    content,
  });

  test("an htmlCodeBlock comes out without that block, and the rest stays", async () => {
    const out = await html(
      doc(
        p(text("antes")),
        htmlBlock(
          text('<img src=x onerror="alert(1)"><script>alert(2)</script>'),
        ),
        p(text("después")),
      ),
    );
    expect(out).toContain("antes");
    expect(out).toContain("después");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onerror");
  });

  test("a variable inside it cannot inject either", async () => {
    const out = await html(
      doc(htmlBlock({ type: "variable", attrs: { id: "first_name" } })),
      { first_name: "<script>alert(1)</script>" },
    );
    expect(out).not.toContain("<script");
  });

  test("it is removed from inside other blocks", async () => {
    const out = await html(
      doc({
        type: "section",
        content: [
          htmlBlock(text("<script>alert(1)</script>")),
          p(text("dentro")),
        ],
      }),
    );
    expect(out).not.toContain("<script");
    expect(out).toContain("dentro");
  });
});

describe("colours", () => {
  test("a colour that is not a colour value is dropped", async () => {
    const out = await html(
      doc(
        p(
          text("rojo", [
            {
              type: "textStyle",
              attrs: { color: "red;background:url(javascript:alert(1))" },
            },
          ]),
        ),
        button("https://example.test/", {
          buttonColor: "#103838;position:fixed",
        }),
      ),
    );
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("position:fixed");
  });

  test("hex, names and rgb pass", () => {
    const d = sanitizeDoc(
      doc(p(text("a", [{ type: "textStyle", attrs: { color: "#103838" } }]))),
      {},
    );
    expect(JSON.stringify(d)).toContain("#103838");
  });
});

describe("findForbiddenNodes, for saving", () => {
  test("a clean document has no problems", () => {
    expect(
      findForbiddenNodes(
        doc(
          p(text("hola")),
          link("https://example.test/"),
          link("mailto:info@example.test"),
          link("{{cancel_url}}"),
          link("https://first_name", { isUrlVariable: true }),
          button("https://example.test/"),
          button("#"),
          { type: "image", attrs: { src: "https://example.test/a.png" } },
          { type: "linkCard", attrs: { link: "cancel_url" } },
        ),
      ),
    ).toEqual([]);
  });

  test("an HTML block is blockNotAllowed, with its place", () => {
    expect(
      findForbiddenNodes(
        doc(p(text("a")), { type: "htmlCodeBlock", content: [text("<b>")] }),
      ),
    ).toEqual([
      { kind: "blockNotAllowed", path: "content[1]", node: "htmlCodeBlock" },
    ]);
  });

  test("bad addresses are linkNotAllowed, with the node and the value", () => {
    const problems = findForbiddenNodes(
      doc(
        link("javascript:alert(1)"),
        button("data:text/html,x"),
        { type: "image", attrs: { src: "data:image/png;base64,AAAA" } },
        {
          type: "image",
          attrs: { src: "https://ok/a.png", externalLink: "vbscript:x" },
        },
        { type: "inlineImage", attrs: { src: "ftp://x/y.png" } },
        {
          type: "linkCard",
          attrs: { link: "javascript:alert(1)", image: "data:x" },
        },
      ),
    );
    expect(problems.map((x) => [x.kind, x.node, x.path, x.value])).toEqual([
      [
        "linkNotAllowed",
        "link",
        "content[0].content[0].marks[0]",
        "javascript:alert(1)",
      ],
      ["linkNotAllowed", "button", "content[1]", "data:text/html,x"],
      ["linkNotAllowed", "image", "content[2]", "data:image/png;base64,AAAA"],
      ["linkNotAllowed", "image", "content[3]", "vbscript:x"],
      ["linkNotAllowed", "inlineImage", "content[4]", "ftp://x/y.png"],
      ["linkNotAllowed", "linkCard", "content[5]", "javascript:alert(1)"],
      ["linkNotAllowed", "linkCard", "content[5]", "data:x"],
    ]);
  });

  test("whatever it flags, sanitizeDoc leaves out of the HTML", async () => {
    const d = doc(
      link("javascript:alert(1)"),
      button("data:text/html,x"),
      { type: "image", attrs: { src: "data:image/png;base64,AAAA" } },
      { type: "htmlCodeBlock", content: [text("<script>alert(1)</script>")] },
    );
    expect(findForbiddenNodes(d).length).toBeGreaterThan(0);
    const out = await html(d);
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out.toLowerCase()).not.toContain("data:");
    expect(out).not.toContain("<script");
  });
});
