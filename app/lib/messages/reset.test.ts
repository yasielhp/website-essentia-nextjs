import { describe, expect, it } from "bun:test";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "./catalog";
import { CLEARED_COLUMNS, resetPlan } from "./reset";

describe("resetPlan", () => {
  it("does nothing when there is no saved row", () => {
    for (const key of MESSAGE_KEYS) {
      expect(resetPlan(key, "email", null)).toBe("none");
      expect(resetPlan(key, "whatsapp", null)).toBe("none");
    }
  });

  it("clears a switched-off reminder and keeps it off", () => {
    expect(resetPlan("booking_reminder", "email", { enabled: false })).toBe(
      "clear",
    );
  });

  it("deletes a reminder that is on: with no text it is the legacy email", () => {
    expect(resetPlan("booking_reminder", "email", { enabled: true })).toBe(
      "delete",
    );
    // A null or odd value in the column is not "off".
    expect(
      resetPlan("booking_reminder", "email", { enabled: null as never }),
    ).toBe("delete");
  });

  it("deletes the row of every message that cannot be switched off", () => {
    for (const key of MESSAGE_KEYS) {
      if (MESSAGE_CATALOG[key].canDisable) continue;
      expect(resetPlan(key, "email", { enabled: true })).toBe("delete");
      // Even a stray `false` there: nothing may stay switched off.
      expect(resetPlan(key, "email", { enabled: false })).toBe("delete");
    }
  });

  it("deletes the WhatsApp row, switched off or not", () => {
    expect(resetPlan("booking_reminder", "whatsapp", { enabled: false })).toBe(
      "delete",
    );
    expect(resetPlan("booking_reminder", "whatsapp", { enabled: true })).toBe(
      "delete",
    );
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
