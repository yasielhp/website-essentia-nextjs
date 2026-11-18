import { describe, expect, it } from "bun:test";
import { MESSAGE_KEYS } from "./catalog";
import { CLEARED_COLUMNS, resetPlan } from "./reset";

describe("resetPlan", () => {
  it("does nothing when there is no saved row", () => {
    for (const key of MESSAGE_KEYS) {
      expect(resetPlan(key, "email", null)).toBe("none");
      expect(resetPlan(key, "whatsapp", null)).toBe("none");
    }
  });

  it("clears a switched-off row of any message and channel and keeps it off", () => {
    for (const key of MESSAGE_KEYS) {
      expect(resetPlan(key, "email", { enabled: false })).toBe("clear");
      expect(resetPlan(key, "whatsapp", { enabled: false })).toBe("clear");
    }
  });

  it("deletes a row that is on: with no text it is the legacy email, and a WhatsApp row with no template sends nothing", () => {
    for (const key of MESSAGE_KEYS) {
      expect(resetPlan(key, "email", { enabled: true })).toBe("delete");
      expect(resetPlan(key, "whatsapp", { enabled: true })).toBe("delete");
      // A null or odd value in the column is not "off".
      expect(resetPlan(key, "email", { enabled: null as never })).toBe(
        "delete",
      );
    }
  });
});

describe("CLEARED_COLUMNS", () => {
  it("empties every content column and names no switch", () => {
    expect(CLEARED_COLUMNS).toEqual({
      subject: null,
      preheader: null,
      title: null,
      doc: null,
      whatsapp_template_id: null,
      whatsapp_params: [],
    });
    expect(CLEARED_COLUMNS).not.toHaveProperty("enabled");
  });
});
