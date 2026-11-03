import { describe, expect, it } from "bun:test";
import { bonusLabelEs } from "./label";

describe("bonusLabelEs", () => {
  it("pluralises the sessions", () => {
    expect(bonusLabelEs(5)).toBe("bono de 5 sesiones");
    expect(bonusLabelEs(10)).toBe("bono de 10 sesiones");
  });

  it("uses the singular for one session", () => {
    expect(bonusLabelEs(1)).toBe("bono de 1 sesión");
  });
});
