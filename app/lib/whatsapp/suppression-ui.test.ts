import { describe, expect, it } from "bun:test";
import { suppressionView } from "./suppression-ui";

describe("suppressionView", () => {
  it("a number on the STOP list is shown, with the way to take it off", () => {
    expect(suppressionView({ ok: true, suppressed: true })).toBe("listed");
  });

  it("a number that is not on it shows nothing", () => {
    expect(suppressionView({ ok: true, suppressed: false })).toBe("hidden");
  });

  it("a list that cannot be read shows nothing: no error, no broken card", () => {
    // The table is created by a migration that may not have been applied yet.
    expect(suppressionView({ ok: false, error: "db" })).toBe("hidden");
    expect(suppressionView({ ok: false, error: "forbidden" })).toBe("hidden");
  });

  it("before the answer arrives, or when the call threw, shows nothing", () => {
    expect(suppressionView(null)).toBe("hidden");
    expect(suppressionView(undefined)).toBe("hidden");
  });

  it("is not fooled by an answer of an unexpected shape", () => {
    expect(suppressionView({ ok: true } as never)).toBe("hidden");
    expect(suppressionView({ suppressed: true } as never)).toBe("hidden");
    expect(suppressionView("yes" as never)).toBe("hidden");
  });
});
