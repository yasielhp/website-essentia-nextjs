import { describe, expect, test } from "bun:test";
import { whatsappConsentState } from "@/lib/whatsapp/consent";

const IN = "2026-11-12T10:00:00.000Z";
const OUT = "2026-11-15T09:30:00.000Z";

describe("whatsappConsentState", () => {
  test("no consent given is none", () => {
    expect(
      whatsappConsentState({
        whatsapp_opted_in_at: null,
        whatsapp_opted_out_at: null,
      }),
    ).toBe("none");
  });

  test("a contact that said yes and never left is accepted", () => {
    expect(
      whatsappConsentState({
        whatsapp_opted_in_at: IN,
        whatsapp_opted_out_at: null,
      }),
    ).toBe("accepted");
  });

  test("a contact that replied STOP is opted out, whatever was said before", () => {
    expect(
      whatsappConsentState({
        whatsapp_opted_in_at: IN,
        whatsapp_opted_out_at: OUT,
      }),
    ).toBe("opted_out");
  });

  test("an opt-out with no recorded opt-in still counts as opted out", () => {
    expect(
      whatsappConsentState({
        whatsapp_opted_in_at: null,
        whatsapp_opted_out_at: OUT,
      }),
    ).toBe("opted_out");
  });

  test("columns missing altogether read as none", () => {
    expect(whatsappConsentState({})).toBe("none");
  });
});
