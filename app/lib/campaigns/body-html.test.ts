import { describe, expect, it } from "bun:test";
import { bodyToHtml, escapeHtml, renderVariables } from "./body-html";

const P_OPEN =
  '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#103838;">';
const A_STYLE = 'style="color:#335554;text-decoration:underline;"';

describe("escapeHtml", () => {
  it("escapes the five characters that can open markup or an attribute", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("leaves everything else alone", () => {
    expect(escapeHtml("Hola, ¿qué tal? ñ é 100%")).toBe(
      "Hola, ¿qué tal? ñ é 100%",
    );
  });
});

describe("bodyToHtml — paragraphs", () => {
  it("turns a blank line into a paragraph break", () => {
    expect(bodyToHtml("Uno\n\nDos")).toBe(`${P_OPEN}Uno</p>${P_OPEN}Dos</p>`);
  });

  it("accepts Windows line endings", () => {
    expect(bodyToHtml("Uno\r\n\r\nDos")).toBe(
      `${P_OPEN}Uno</p>${P_OPEN}Dos</p>`,
    );
  });

  it("collapses several blank lines into one break", () => {
    expect(bodyToHtml("Uno\n\n\n\n\nDos")).toBe(
      `${P_OPEN}Uno</p>${P_OPEN}Dos</p>`,
    );
  });

  it("treats a whitespace-only line as blank", () => {
    expect(bodyToHtml("Uno\n   \nDos")).toBe(
      `${P_OPEN}Uno</p>${P_OPEN}Dos</p>`,
    );
  });

  it("drops leading and trailing blank lines and surrounding spaces", () => {
    expect(bodyToHtml("\n\n  Uno  \n\n\n")).toBe(`${P_OPEN}Uno</p>`);
  });

  it("returns an empty string for an empty or blank body", () => {
    expect(bodyToHtml("")).toBe("");
    expect(bodyToHtml("  \n\n \r\n ")).toBe("");
  });

  it("turns a single newline into a line break inside the paragraph", () => {
    expect(bodyToHtml("Uno\nDos")).toBe(`${P_OPEN}Uno<br />Dos</p>`);
  });
});

describe("bodyToHtml — bold", () => {
  it("wraps **text** in <strong>", () => {
    expect(bodyToHtml("Hola **mundo**")).toBe(
      `${P_OPEN}Hola <strong>mundo</strong></p>`,
    );
  });

  it("handles two bolds in one paragraph without bridging them", () => {
    expect(bodyToHtml("**a** y **b**")).toBe(
      `${P_OPEN}<strong>a</strong> y <strong>b</strong></p>`,
    );
  });

  it("leaves an unmatched ** as literal text", () => {
    expect(bodyToHtml("precio **sin cerrar")).toBe(
      `${P_OPEN}precio **sin cerrar</p>`,
    );
  });

  it("does not bold an empty pair", () => {
    expect(bodyToHtml("a **** b")).toBe(`${P_OPEN}a **** b</p>`);
  });
});

describe("bodyToHtml — links", () => {
  it("turns [label](https://…) into a styled anchor", () => {
    expect(bodyToHtml("Ver [la web](https://essentia.com/es)")).toBe(
      `${P_OPEN}Ver <a href="https://essentia.com/es" ${A_STYLE}>la web</a></p>`,
    );
  });

  it("accepts an uppercase HTTPS scheme", () => {
    expect(bodyToHtml("[x](HTTPS://a.com)")).toBe(
      `${P_OPEN}<a href="HTTPS://a.com" ${A_STYLE}>x</a></p>`,
    );
  });

  it("keeps a bold label inside the link", () => {
    expect(bodyToHtml("[**Reserva**](https://a.com)")).toBe(
      `${P_OPEN}<a href="https://a.com" ${A_STYLE}><strong>Reserva</strong></a></p>`,
    );
  });

  it.each(["http://a.com", "javascript:alert(1)", "mailto:a@b.com", "ftp://x"])(
    "leaves a %s link as escaped text",
    (url) => {
      const html = bodyToHtml(`[x](${url})`);
      expect(html).not.toContain("<a ");
      expect(html).toBe(`${P_OPEN}[x](${escapeHtml(url)})</p>`);
    },
  );

  it("refuses a URL with whitespace in it", () => {
    const html = bodyToHtml("[x](https://a.com/b c)");
    expect(html).not.toContain("<a ");
  });

  // An anchor with nothing inside is invisible and unclickable, so a typo like
  // `[](https://…)` is better left visible than silently swallowed.
  it("leaves a link with an empty label as literal text", () => {
    expect(bodyToHtml("[](https://a.com)")).toBe(
      `${P_OPEN}[](https://a.com)</p>`,
    );
  });

  it("escapes the link label", () => {
    expect(bodyToHtml("[<b>](https://a.com)")).toBe(
      `${P_OPEN}<a href="https://a.com" ${A_STYLE}>&lt;b&gt;</a></p>`,
    );
  });

  it("never lets a quote in the URL break out of the href attribute", () => {
    const html = bodyToHtml('[x](https://a.com/"x)');
    expect(html).toContain("&quot;");
    expect(html).not.toMatch(/href="https:\/\/a\.com\/"x/);
    expect(html).toBe(
      `${P_OPEN}<a href="https://a.com/&quot;x" ${A_STYLE}>x</a></p>`,
    );
  });
});

describe("bodyToHtml — escaping", () => {
  it("escapes tags so they render as text", () => {
    expect(bodyToHtml("<script>alert(1)</script>")).toBe(
      `${P_OPEN}&lt;script&gt;alert(1)&lt;/script&gt;</p>`,
    );
  });

  it("escapes ampersands", () => {
    expect(bodyToHtml("Tú & yo")).toBe(`${P_OPEN}Tú &amp; yo</p>`);
  });
});

describe("renderVariables", () => {
  it("replaces every {{first_name}}", () => {
    expect(
      renderVariables("Hola {{first_name}}, {{first_name}}", {
        first_name: "Ana",
      }),
    ).toBe("Hola Ana, Ana");
  });

  it("tolerates spaces inside the braces", () => {
    expect(
      renderVariables("Hola {{ first_name }}", { first_name: "Ana" }),
    ).toBe("Hola Ana");
  });

  it("escapes the value by default", () => {
    expect(renderVariables("Hola {{first_name}}", { first_name: "<b>" })).toBe(
      "Hola &lt;b&gt;",
    );
  });

  it("inserts the value raw when escape is off (plain-text subjects)", () => {
    expect(
      renderVariables(
        "Hola {{first_name}}",
        { first_name: "Ana & Luis" },
        { escape: false },
      ),
    ).toBe("Hola Ana & Luis");
  });

  it("does not touch other tokens", () => {
    expect(renderVariables("{{last_name}}", { first_name: "Ana" })).toBe(
      "{{last_name}}",
    );
  });

  describe("with an empty name", () => {
    it("removes the token and the one space before it", () => {
      expect(renderVariables("Hola {{first_name}}", { first_name: "" })).toBe(
        "Hola",
      );
      expect(
        renderVariables("Hola {{first_name}}", { first_name: "   " }),
      ).toBe("Hola");
    });

    it("keeps the punctuation that follows", () => {
      expect(
        renderVariables("Hola {{first_name}}, bienvenida", { first_name: "" }),
      ).toBe("Hola, bienvenida");
    });

    it("eats only one space, so a double space collapses to one", () => {
      expect(
        renderVariables("Hola  {{first_name}} x", { first_name: "" }),
      ).toBe("Hola  x");
    });

    // A token at the very start has no space to take with it, so the comma
    // that followed the name survives: ", hola". We accept that rather than
    // guessing at punctuation — the dashboard preview shows the admin what a
    // nameless subscriber will see, and "Hola {{first_name}}" is the idiom.
    it("leaves following punctuation when the token opens the text", () => {
      expect(renderVariables("{{first_name}}, hola", { first_name: "" })).toBe(
        ", hola",
      );
    });

    it("trims the result", () => {
      expect(renderVariables(" {{first_name}} ", { first_name: "" })).toBe("");
    });
  });
});
