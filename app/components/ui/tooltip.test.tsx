import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipBubble, tooltipPlacement } from "./tooltip";

describe("where the tooltip goes", () => {
  const rect = { left: 100, right: 132, top: 300, bottom: 332 };

  test("over the element, above it, with its middle kept far enough from the side", () => {
    expect(tooltipPlacement(rect, 1200)).toEqual({
      x: 136,
      y: 292,
      below: false,
    });
  });

  test("with no room above (the top of the window), below it", () => {
    const top = { left: 600, right: 632, top: 10, bottom: 42 };
    const place = tooltipPlacement(top, 1200);
    expect(place.below).toBe(true);
    expect(place.y).toBeGreaterThan(top.bottom);
  });

  test("kept inside the window at either side, so the widest bubble is never cut", () => {
    const left = tooltipPlacement(
      { left: 0, right: 32, top: 300, bottom: 332 },
      390,
    );
    const right = tooltipPlacement(
      { left: 358, right: 390, top: 300, bottom: 332 },
      390,
    );
    expect(left.x - 128).toBeGreaterThanOrEqual(0);
    expect(right.x + 128).toBeLessThanOrEqual(390);
  });
});

describe("the bubble", () => {
  test("is a tooltip with the id the element points at, drawn at a fixed place so no overflow cuts it", () => {
    const html = renderToStaticMarkup(
      <TooltipBubble
        id="tip-1"
        rect={{ left: 100, right: 132, top: 300, bottom: 332 }}
        viewportWidth={1200}
      >
        Fecha
      </TooltipBubble>,
    );
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('id="tip-1"');
    expect(html).toContain("position:fixed");
    expect(html).toContain(">Fecha<");
    // It never takes the pointer from what is under it.
    expect(html).toContain("pointer-events-none");
  });
});
