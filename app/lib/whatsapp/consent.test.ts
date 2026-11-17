import { describe, expect, test } from "bun:test";
import {
  activeWhatsAppUses,
  whatsappActivationPatch,
  whatsappConsentColumn,
  whatsappConsentState,
} from "@/lib/whatsapp/consent";

const IN = "2026-11-12T10:00:00.000Z";
const OUT = "2026-11-15T09:30:00.000Z";

describe("whatsappConsentState", () => {
  test("nothing given is none for both uses and not opted out", () => {
    expect(whatsappConsentState({})).toEqual({
      optedOut: false,
      appointments: "none",
      marketing: "none",
    });
  });

  test("each use is read from its own column", () => {
    expect(whatsappConsentState({ whatsapp_opted_in_at: IN })).toEqual({
      optedOut: false,
      appointments: "accepted",
      marketing: "none",
    });
    expect(
      whatsappConsentState({ whatsapp_marketing_opted_in_at: IN }),
    ).toEqual({ optedOut: false, appointments: "none", marketing: "accepted" });
  });

  test("a STOP switches both uses off whatever dates are stored", () => {
    expect(
      whatsappConsentState({
        whatsapp_opted_in_at: IN,
        whatsapp_marketing_opted_in_at: IN,
        whatsapp_opted_out_at: OUT,
      }),
    ).toEqual({ optedOut: true, appointments: "none", marketing: "none" });
  });

  test("an opt-out with no opt-in at all is still opted out", () => {
    expect(whatsappConsentState({ whatsapp_opted_out_at: OUT })).toEqual({
      optedOut: true,
      appointments: "none",
      marketing: "none",
    });
  });
});

describe("activeWhatsAppUses", () => {
  test("a use is active when consented and not stopped", () => {
    expect(
      activeWhatsAppUses({
        whatsapp_opted_in_at: IN,
        whatsapp_marketing_opted_in_at: null,
        whatsapp_opted_out_at: null,
      }),
    ).toEqual({ appointments: true, marketing: false });
  });

  test("a STOP turns both off whatever was consented", () => {
    expect(
      activeWhatsAppUses({
        whatsapp_opted_in_at: IN,
        whatsapp_marketing_opted_in_at: IN,
        whatsapp_opted_out_at: OUT,
      }),
    ).toEqual({ appointments: false, marketing: false });
  });
});

describe("whatsappConsentColumn", () => {
  test("names the column a use is stored in", () => {
    expect(whatsappConsentColumn("appointments")).toBe("whatsapp_opted_in_at");
    expect(whatsappConsentColumn("marketing")).toBe(
      "whatsapp_marketing_opted_in_at",
    );
  });
});

describe("whatsappActivationPatch", () => {
  const NOW = "2026-11-17T12:00:00.000Z";

  test("with no STOP, a use with a date keeps it and the other is left alone", () => {
    const patch = whatsappActivationPatch(
      "marketing",
      { whatsapp_marketing_opted_in_at: IN, whatsapp_opted_in_at: IN },
      NOW,
    );
    expect(patch).toEqual({
      whatsapp_marketing_opted_in_at: IN,
      whatsapp_opted_out_at: null,
    });
    expect("whatsapp_opted_in_at" in patch).toBe(false);
  });

  test("with no STOP, an empty use is stamped now", () => {
    expect(whatsappActivationPatch("appointments", {}, NOW)).toEqual({
      whatsapp_opted_in_at: NOW,
      whatsapp_opted_out_at: null,
    });
  });

  test("after a STOP the activated use is stamped now and the other is withdrawn", () => {
    expect(
      whatsappActivationPatch(
        "appointments",
        {
          whatsapp_opted_in_at: IN,
          whatsapp_marketing_opted_in_at: IN,
          whatsapp_opted_out_at: OUT,
        },
        NOW,
      ),
    ).toEqual({
      whatsapp_opted_in_at: NOW,
      whatsapp_marketing_opted_in_at: null,
      whatsapp_opted_out_at: null,
    });
    expect(
      whatsappActivationPatch(
        "marketing",
        {
          whatsapp_opted_in_at: IN,
          whatsapp_marketing_opted_in_at: IN,
          whatsapp_opted_out_at: OUT,
        },
        NOW,
      ),
    ).toEqual({
      whatsapp_marketing_opted_in_at: NOW,
      whatsapp_opted_in_at: null,
      whatsapp_opted_out_at: null,
    });
  });
});
