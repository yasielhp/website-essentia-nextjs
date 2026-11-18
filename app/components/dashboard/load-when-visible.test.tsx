import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadWhenVisible } from "./load-when-visible";

describe("LoadWhenVisible", () => {
  test("draws the placeholder first, and not what it holds back (which would start reading)", () => {
    const html = renderToStaticMarkup(
      <LoadWhenVisible placeholder={<p>cargando</p>}>
        <p>el contenido</p>
      </LoadWhenVisible>,
    );
    expect(html).toContain("cargando");
    expect(html).not.toContain("el contenido");
  });
});
