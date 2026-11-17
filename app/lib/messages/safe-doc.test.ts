import { describe, expect, test } from "bun:test";
import { join } from "node:path";
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
  // A bare node is the body's only content: the root is always a `doc`.
  const root = d.type === "doc" ? d : doc(d);
  const fragment = await renderBodyFragment(sanitizeDoc(root, values), values);
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
  // A value that is no address leaves nothing to press: the text of a link
  // stays without its link, and a button goes altogether. A button that leads
  // nowhere is worse than none (the consent button of somebody who has already
  // signed has an empty `consent_url`).
  for (const bad of HOSTILE) {
    test(`link, value ${JSON.stringify(bad)} keeps the text and loses the link`, async () => {
      const out = await html(
        link("https://first_name", { isUrlVariable: true }),
        {
          first_name: bad,
        },
      );
      expect(urls(out)).toEqual([]);
      expect(out).not.toContain("<a");
      expect(out).toContain("pulsa");
    });

    test(`button, value ${JSON.stringify(bad)} is removed`, async () => {
      const out = await html(
        doc(
          p(text("antes")),
          button("https://first_name", { isUrlVariable: true }),
          p(text("después")),
        ),
        { first_name: bad },
      );
      expect(urls(out)).toEqual([]);
      expect(out).not.toContain("Botón");
      expect(out).toContain("antes");
      expect(out).toContain("después");
    });
  }

  test("the button the editor inserts for a link variable goes when the link is empty", async () => {
    // What `linkButtonNode("consent_url")` writes: the bare name and the flag.
    const consent = button("consent_url", { isUrlVariable: true });
    const signed = await html(doc(p(text("Hola")), consent), {
      consent_url: "",
    });
    expect(signed).not.toContain("Botón");
    expect(urls(signed)).toEqual([]);
    expect(signed).toContain("Hola");

    const pending = await html(doc(p(text("Hola")), consent), {
      consent_url: "https://example.test/consent?token=abc",
    });
    expect(pending).toContain("Botón");
    expect(urls(pending)).toEqual(["https://example.test/consent?token=abc"]);
  });

  test("an address that is one token and nothing else is a variable too", async () => {
    for (const bad of ["", "javascript:alert(1)"]) {
      const values = { consent_url: bad };
      const btn = await html(
        doc(p(text("Hola")), button("{{consent_url}}")),
        values,
      );
      expect(btn).not.toContain("Botón");
      expect(urls(btn)).toEqual([]);
      const lnk = await html(link(" {{ consent_url }} "), values);
      expect(urls(lnk)).toEqual([]);
      expect(lnk).not.toContain("<a");
      expect(lnk).toContain("pulsa");
    }
    const good = { consent_url: "https://example.test/c" };
    expect(urls(await html(doc(button("{{consent_url}}")), good))).toEqual([
      "https://example.test/c",
    ]);
    expect(urls(await html(link("{{consent_url}}"), good))).toEqual([
      "https://example.test/c",
    ]);
  });

  test("a button inside a section or a column goes the same way", async () => {
    const out = await html(
      doc({
        type: "section",
        content: [
          p(text("dentro")),
          button("consent_url", { isUrlVariable: true }),
        ],
      }),
      { consent_url: "" },
    );
    expect(out).toContain("dentro");
    expect(out).not.toContain("Botón");
    expect(urls(out)).toEqual([]);
  });

  test("the other marks of a link that goes stay on its text", async () => {
    const clean = sanitizeDoc(
      doc(
        p(
          text("pulsa", [
            { type: "bold" },
            {
              type: "link",
              attrs: { href: "consent_url", isUrlVariable: true },
            },
          ]),
        ),
      ),
      { consent_url: "" },
    );
    expect(clean.content?.[0]?.content?.[0]).toEqual({
      type: "text",
      text: "pulsa",
      marks: [{ type: "bold" }],
    });
  });

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

  test("a variable nobody provided is no link at all, not a relative address", async () => {
    const out = await html(link("https://nope", { isUrlVariable: true }), {});
    expect(urls(out)).toEqual([]);
    expect(out).toContain("pulsa");
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
      expect(urls(out)).toEqual([]);
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
    // The token alone is a variable address: with a bad value the link goes.
    const bad = await html(link("{{cancel_url}}"), {
      cancel_url: "javascript:alert(1)",
    });
    expect(urls(bad)).toEqual([]);
    expect(bad).toContain("pulsa");
  });

  // `{{consent_url}}?x=1`: the address is the variable's, with something
  // after it. Without the variable there is no address, only the tail.
  test("an address that starts with a variable and goes on is a variable one: it goes when it does not hold", async () => {
    for (const consent_url of ["", "javascript:alert(1)"]) {
      const out = await html(
        doc(
          link("{{consent_url}}?x=1"),
          p(text("medio")),
          button(" {{ consent_url }}&utm=correo"),
          button("{{consent_url}}reserva"),
        ),
        { consent_url },
      );
      expect(urls(out)).toEqual([]);
      expect(out).not.toContain("<a");
      expect(out).not.toContain("Botón");
      expect(out).toContain("pulsa");
      expect(out).toContain("medio");
      expect(out.toLowerCase()).not.toContain("javascript:");
    }
  });

  test("and with an address in the variable it is that address, tail and all", async () => {
    const out = await html(
      doc(link("{{consent_url}}&x=1"), button("{{consent_url}}&utm=correo")),
      { consent_url: "https://example.test/c?token=abc" },
    );
    expect(urls(out)).toEqual([
      "https://example.test/c?token=abc&x=1",
      "https://example.test/c?token=abc&utm=correo",
    ]);
  });

  test("a fixed address with a token further in is still a fixed one: # when it does not hold", async () => {
    const values = { first_name: "javascript:alert(1)", cancel_url: "" };
    const out = await html(
      doc(
        link("x{{first_name}}"),
        button("https://example.test/{{cancel_url}}"),
        button("mailto:{{cancel_url}}"),
      ),
      values,
    );
    expect(urls(out)).toEqual(["#", "https://example.test/", "mailto:"]);
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
    const good = await html(doc(card({ link: "where" })), {
      where: "https://example.test/d",
    });
    expect(urls(good).every((h) => h === "https://example.test/d")).toBe(true);
    expect(urls(good)).not.toEqual([]);
  });

  // The same as a button: a card whose address is a variable and nothing else
  // is not left pointing at `#` when the variable holds no address this time.
  for (const link of ["consent_url", " consent_url ", "{{consent_url}}"]) {
    for (const value of ["", "javascript:alert(1)", undefined]) {
      test(`a link card to the variable ${JSON.stringify(link)} holding ${JSON.stringify(value)} is removed`, async () => {
        const values: Record<string, string> =
          value === undefined ? {} : { consent_url: value };
        const out = await html(
          doc(p(text("antes")), card({ link }), p(text("después"))),
          values,
        );
        expect(urls(out)).toEqual([]);
        expect(out).not.toContain("<a");
        expect(out).toContain("antes");
        expect(out).toContain("después");
        expect(out.toLowerCase()).not.toContain("javascript:");
      });
    }

    test(`a link card to the variable ${JSON.stringify(link)} holding an address is kept`, async () => {
      const out = await html(doc(card({ link })), {
        consent_url: "https://example.test/consent?token=abc",
      });
      expect(urls(out)).not.toEqual([]);
      for (const href of urls(out)) {
        expect(href).toBe("https://example.test/consent?token=abc");
      }
    });
  }

  test("a link card whose address starts with a variable that holds none is removed too", async () => {
    for (const consent_url of ["", "javascript:alert(1)"]) {
      const out = await html(
        doc(p(text("antes")), card({ link: "{{consent_url}}?x=1" })),
        { consent_url },
      );
      expect(urls(out)).toEqual([]);
      expect(out).toContain("antes");
    }
    const good = await html(doc(card({ link: "{{consent_url}}&x=1" })), {
      consent_url: "https://example.test/c?t=1",
    });
    expect(urls(good)).not.toEqual([]);
    for (const href of urls(good)) {
      expect(href).toBe("https://example.test/c?t=1&x=1");
    }
  });

  test("a link card with a fixed address that does not hold still goes to #", async () => {
    for (const link of [
      "",
      "/relative",
      "www.example.test",
      "x{{consent_url}}",
    ]) {
      const out = await html(doc(card({ link })), { consent_url: "" });
      expect(urls(out)).not.toEqual([]);
      for (const href of urls(out)) expect(href).toBe("#");
    }
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

describe("a block set to show conditionally", () => {
  // The renderer draws a node with `showIfKey` only when a payload value of
  // that name is truthy, and a transactional email is rendered with none: the
  // block would never be sent.
  const conditional = doc(
    { ...p(text("siempre")), attrs: { showIfKey: "" } },
    { ...p(text("párrafo condicional")), attrs: { showIfKey: "first_name" } },
    {
      type: "section",
      attrs: { showIfKey: "es_vip" },
      content: [p(text("sección condicional"))],
    },
    {
      ...button("https://example.test/x"),
      attrs: { ...button("https://example.test/x").attrs, showIfKey: "es_vip" },
    },
  );

  test("the renderer alone never draws it", async () => {
    const raw = await renderBodyFragment(conditional, { first_name: "Ana" });
    expect(raw).toContain("siempre");
    expect(raw).not.toContain("párrafo condicional");
    expect(raw).not.toContain("sección condicional");
  });

  test("sending takes the condition off: what the admin wrote goes out", async () => {
    const out = await html(conditional, { first_name: "Ana" });
    expect(out).toContain("siempre");
    expect(out).toContain("párrafo condicional");
    expect(out).toContain("sección condicional");
    expect(urls(out)).toEqual(["https://example.test/x"]);
    expect(JSON.stringify(sanitizeDoc(conditional, {}))).not.toContain(
      "showIfKey",
    );
  });

  test("saving refuses it, with its place", () => {
    expect(findForbiddenNodes(conditional)).toEqual([
      { kind: "blockNotAllowed", path: "content[1]", node: "paragraph" },
      { kind: "blockNotAllowed", path: "content[2]", node: "section" },
      { kind: "blockNotAllowed", path: "content[3]", node: "button" },
    ]);
  });

  test("the empty condition the editor writes on every block is no condition", () => {
    for (const showIfKey of ["", null, undefined]) {
      const d = doc({ ...p(text("hola")), attrs: { showIfKey } });
      expect(findForbiddenNodes(d)).toEqual([]);
    }
  });

  test("a condition deep inside is found", () => {
    const d = doc({
      type: "columns",
      content: [
        {
          type: "column",
          content: [{ ...p(text("x")), attrs: { showIfKey: "k" } }],
        },
      ],
    });
    expect(findForbiddenNodes(d)).toEqual([
      {
        kind: "blockNotAllowed",
        path: "content[0].content[0].content[0]",
        node: "paragraph",
      },
    ]);
  });
});

// ── the allow-list ─────────────────────────────────────────────────────────

describe("node types are an allow-list", () => {
  const BAD_TYPES = [
    "render",
    "markup",
    "children",
    "constructor",
    "toString",
    "__proto__",
    "hasOwnProperty",
    "valueOf",
    "for",
    "foo",
    "codeBlock",
    "htmlCodeBlock",
    "repeat",
    "doc",
    "",
  ];

  for (const type of BAD_TYPES) {
    test(`${JSON.stringify(type)} is dropped, with its children, and refused at saving`, async () => {
      const d = doc(p(text("visible")), {
        type,
        content: [p(text("oculto"))],
      });
      const clean = sanitizeDoc(d, {});
      expect(JSON.stringify(clean)).not.toContain("oculto");
      expect(JSON.stringify(clean)).toContain("visible");
      expect(findForbiddenNodes(d)).toEqual([
        { kind: "blockNotAllowed", path: "content[1]", node: type },
      ]);
    });
  }

  test("`doc` is the root and only the root", () => {
    const nested = doc(p(text("visible")), doc(p(text("oculto"))));
    expect(findForbiddenNodes(nested)).toEqual([
      { kind: "blockNotAllowed", path: "content[1]", node: "doc" },
    ]);
    const clean = JSON.stringify(sanitizeDoc(nested, {}));
    expect(clean).toContain("visible");
    expect(clean).not.toContain("oculto");
    // Deeper still, and a root that is not a doc at all.
    const deep = doc({ type: "section", content: [doc(p(text("x")))] });
    expect(findForbiddenNodes(deep).map((x) => x.path)).toEqual([
      "content[0].content[0]",
    ]);
    expect(findForbiddenNodes(p(text("x")))).toEqual([
      { kind: "blockNotAllowed", path: "", node: "paragraph" },
    ]);
    expect(sanitizeDoc(p(text("x")), {})).toEqual({ type: "doc", content: [] });
  });

  test("a repeat block is refused: it draws nothing here and throws on a hostile `each`", async () => {
    const d = doc(p(text("visible")), {
      type: "repeat",
      attrs: { each: "__proto__" },
      content: [p(text("x"))],
    });
    expect(findForbiddenNodes(d)).toEqual([
      { kind: "blockNotAllowed", path: "content[1]", node: "repeat" },
    ]);
    const out = await html(d);
    expect(out).toContain("visible");
  });

  test("a node with no type, or a type that is not text, is dropped", () => {
    for (const bad of [{}, { type: 7 }, { type: null }, null, "x", 3]) {
      const d = doc(p(text("visible")), bad as never);
      expect(JSON.stringify(sanitizeDoc(d, {}))).toBe(
        JSON.stringify(doc(p(text("visible")))),
      );
      expect(findForbiddenNodes(d)).toHaveLength(1);
    }
  });

  test("an unknown node deep inside is found and dropped", () => {
    const d = doc({
      type: "section",
      content: [{ type: "columns", content: [{ type: "render" }] }],
    });
    expect(findForbiddenNodes(d)).toEqual([
      {
        kind: "blockNotAllowed",
        path: "content[0].content[0].content[0]",
        node: "render",
      },
    ]);
  });

  test("a mark that is not a known one loses the mark, not the text", () => {
    const d = doc(
      p({
        type: "text",
        text: "hola",
        marks: [{ type: "render" }, { type: "bold" }, { type: "constructor" }],
      }),
    );
    expect(JSON.stringify(sanitizeDoc(d, {}))).toBe(
      JSON.stringify(
        doc(p({ type: "text", text: "hola", marks: [{ type: "bold" }] })),
      ),
    );
    expect(findForbiddenNodes(d).map((x) => [x.kind, x.node, x.path])).toEqual([
      ["blockNotAllowed", "render", "content[0].content[0].marks[0]"],
      ["blockNotAllowed", "constructor", "content[0].content[0].marks[2]"],
    ]);
  });

  // One of every type the editor can produce, as a document that must save
  // and must render.
  const LEGIT: EmailDoc = doc(
    p(
      text("a", [{ type: "bold" }, { type: "italic" }, { type: "underline" }]),
      text("b", [{ type: "strike" }, { type: "code" }]),
      text("c", [{ type: "textStyle", attrs: { color: "#103838" } }]),
      text("d", [{ type: "link", attrs: { href: "https://example.test/" } }]),
      { type: "hardBreak" },
      { type: "variable", attrs: { id: "first_name", fallback: "x" } },
      { type: "inlineImage", attrs: { src: "https://example.test/i.png" } },
    ),
    { type: "heading", attrs: { level: 2 }, content: [text("h")] },
    {
      type: "bulletList",
      content: [{ type: "listItem", content: [p(text("li"))] }],
    },
    {
      type: "orderedList",
      content: [{ type: "listItem", content: [p(text("li"))] }],
    },
    { type: "blockquote", content: [p(text("q"))] },
    button("https://example.test/"),
    { type: "image", attrs: { src: "https://example.test/a.png", width: 100 } },
    { type: "logo", attrs: { src: "https://example.test/l.png", size: "sm" } },
    { type: "spacer", attrs: { height: 8 } },
    { type: "horizontalRule" },
    { type: "footer", content: [text("pie")] },
    {
      type: "linkCard",
      attrs: { title: "t", description: "d", link: "https://example.test/" },
    },
    { type: "section", content: [p(text("s"))] },
    {
      type: "columns",
      content: [
        { type: "column", attrs: { width: 50 }, content: [p(text("c1"))] },
        { type: "column", attrs: { width: 50 }, content: [p(text("c2"))] },
      ],
    },
  );

  test("a document with one of every type the editor makes passes saving", () => {
    expect(findForbiddenNodes(LEGIT)).toEqual([]);
  });

  test("and it renders, with every type still in it", async () => {
    const out = await html(LEGIT, { first_name: "Ana" });
    for (const word of ["a", "pie", "c1", "c2", "q"])
      expect(out).toContain(word);
    expect(out).toContain("<strong");
    expect(out).toContain("<hr");
    expect(out).toContain("<blockquote");
    expect(out).toContain("<ul");
    expect(out).toContain("<ol");
    expect(out).toContain("<h2");
    expect(out).toContain("https://example.test/a.png");
  });

  test("the default body of every message passes saving", async () => {
    const { MESSAGE_KEYS } = await import("./catalog");
    const { defaultContent } = await import("@/emails/defaults");
    for (const key of MESSAGE_KEYS) {
      for (const locale of ["es", "en"] as const) {
        const d = defaultContent(key, locale);
        expect(findForbiddenNodes(d.doc!)).toEqual([]);
        expect(findForbiddenNodes(d.intro)).toEqual([]);
        if (d.outro) expect(findForbiddenNodes(d.outro)).toEqual([]);
      }
    }
  });

  test("composing an email from node types that are method names of the renderer finishes", () => {
    // In another process: with no allow-list, `render` never returns and a
    // synchronous loop cannot be timed out from inside the test.
    const run = Bun.spawnSync({
      cmd: ["bun", join(import.meta.dir, "safe-doc.child.ts")],
      // The child resolves `@/` through the project's tsconfig.
      cwd: join(import.meta.dir, "..", "..", ".."),
      timeout: 20_000,
      killSignal: "SIGKILL",
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(run.stdout.toString().trim()).toBe("done");
    expect(run.exitCode).toBe(0);
  }, 30_000);
});

describe("attributes that feed inline style", () => {
  const section = (attrs: Record<string, unknown>): EmailDoc => ({
    type: "section",
    attrs,
    content: [p(text("x"))],
  });
  const attrsOf = (d: EmailDoc) =>
    (sanitizeDoc(doc(d), {}).content?.[0]?.attrs ?? {}) as Record<
      string,
      unknown
    >;

  for (const evil of [
    "1px;background:url(//evil.com)",
    "5px; position:fixed",
    "url(//evil.com)",
    "expression(alert(1))",
    "10px 20px",
    "",
    "left;x:y",
    {},
    [],
  ]) {
    test(`${JSON.stringify(evil)} in a padding, a radius or a width is dropped`, () => {
      const a = attrsOf(
        section({
          paddingTop: evil,
          paddingLeft: evil,
          borderRadius: evil,
          borderWidth: evil,
          marginTop: evil,
          align: evil,
          width: evil,
        }),
      );
      for (const key of [
        "paddingTop",
        "paddingLeft",
        "borderRadius",
        "borderWidth",
        "marginTop",
        "align",
        "width",
      ]) {
        expect(a).not.toHaveProperty(key);
      }
    });
  }

  test("numbers, numbers with a unit and the editor's own words pass", () => {
    const a = attrsOf(
      section({
        paddingTop: 5,
        paddingLeft: "12px",
        borderRadius: "50%",
        borderWidth: 1.5,
        marginTop: "0",
        align: "center",
        width: "auto",
      }),
    );
    expect(a).toEqual({
      paddingTop: 5,
      paddingLeft: "12px",
      borderRadius: "50%",
      borderWidth: 1.5,
      marginTop: "0",
      align: "center",
      width: "auto",
    });
  });

  test("a button's variant, radius and alignment keep the editor's words only", () => {
    const keep = sanitizeDoc(
      doc(
        button("https://example.test/", {
          borderRadius: "round",
          alignment: "center",
          variant: "outline",
        }),
      ),
      {},
    ).content![0]!.attrs!;
    expect(keep).toMatchObject({
      borderRadius: "round",
      alignment: "center",
      variant: "outline",
    });
    const drop = sanitizeDoc(
      doc(
        button("https://example.test/", {
          borderRadius: "9px;x:y",
          alignment: "x;y",
          variant: "a;b",
          paddingTop: "1px;background:url(//evil.com)",
        }),
      ),
      {},
    ).content![0]!.attrs!;
    for (const key of ["borderRadius", "alignment", "variant", "paddingTop"]) {
      expect(drop).not.toHaveProperty(key);
    }
  });

  test("a paragraph's alignment and a logo's size", () => {
    const para = sanitizeDoc(
      doc({
        type: "paragraph",
        attrs: { textAlign: "left;x:y" },
        content: [text("a")],
      }),
      {},
    ).content![0]!.attrs!;
    expect(para).not.toHaveProperty("textAlign");
    const logo = sanitizeDoc(
      doc({
        type: "logo",
        attrs: {
          src: "https://example.test/l.png",
          size: "9px;x:y",
          alignment: "right",
        },
      }),
      {},
    ).content![0]!.attrs!;
    expect(logo).not.toHaveProperty("size");
    expect(logo).toMatchObject({ alignment: "right" });
  });

  test("it does not reach the HTML", async () => {
    const out = await html(
      doc(
        {
          type: "inlineImage",
          attrs: {
            src: "https://example.test/i.png",
            width: "1px;background:url(//evil.com)",
            height: 20,
          },
        } as EmailDoc,
        { type: "spacer", attrs: { height: "1px;background:url(//evil.com)" } },
        section({ paddingTop: "1px;background:url(//evil.com)" }),
      ),
    );
    expect(out).not.toContain("evil.com");
  });
});
