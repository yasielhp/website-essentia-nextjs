import { describe, expect, test } from "bun:test";
import {
  NOTICE_CONSENT_WINDOW_MS,
  isContactFresh,
  marketingConsentActive,
  pickNoticeEmail,
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

describe("marketingConsentActive", () => {
  const ON = {
    newsletter_subscribed: true,
    newsletter_unsubscribed_at: null,
    whatsapp_marketing_opted_in_at: IN,
    whatsapp_opted_out_at: null,
  };

  test("on only when both channels are on and nobody stopped", () => {
    expect(marketingConsentActive(ON)).toBe(true);
  });

  test("with only one of the two it is not on, so the box shows unticked", () => {
    expect(
      marketingConsentActive({ ...ON, whatsapp_marketing_opted_in_at: null }),
    ).toBe(false);
    expect(
      marketingConsentActive({ ...ON, newsletter_subscribed: false }),
    ).toBe(false);
    expect(marketingConsentActive({ ...ON, newsletter_subscribed: null })).toBe(
      false,
    );
  });

  test("a WhatsApp STOP or an email unsubscribe switches it off", () => {
    expect(marketingConsentActive({ ...ON, whatsapp_opted_out_at: OUT })).toBe(
      false,
    );
    expect(
      marketingConsentActive({ ...ON, newsletter_unsubscribed_at: OUT }),
    ).toBe(false);
  });

  test("an empty row is not on", () => {
    expect(marketingConsentActive({})).toBe(false);
  });
});

describe("isContactFresh", () => {
  const NOW = new Date("2026-11-17T12:00:00.000Z");
  const minutesAgo = (m: number) =>
    new Date(NOW.getTime() - m * 60_000).toISOString();

  test("a contact written a minute ago is fresh", () => {
    expect(isContactFresh({ updated_at: minutesAgo(1) }, NOW)).toBe(true);
  });

  test("the window is fifteen minutes, edge included", () => {
    expect(isContactFresh({ updated_at: minutesAgo(15) }, NOW)).toBe(true);
    expect(isContactFresh({ updated_at: minutesAgo(15.1) }, NOW)).toBe(false);
    expect(NOTICE_CONSENT_WINDOW_MS).toBe(15 * 60_000);
  });

  test("created_at counts when updated_at is missing, and the newer one wins", () => {
    expect(isContactFresh({ created_at: minutesAgo(2) }, NOW)).toBe(true);
    expect(
      isContactFresh(
        { created_at: minutesAgo(2), updated_at: minutesAgo(600) },
        NOW,
      ),
    ).toBe(true);
  });

  test("an old, missing or unreadable date is not fresh", () => {
    expect(isContactFresh({ updated_at: minutesAgo(600) }, NOW)).toBe(false);
    expect(isContactFresh({}, NOW)).toBe(false);
    expect(isContactFresh({ updated_at: "not a date" }, NOW)).toBe(false);
  });

  test("a date in the future is not trusted", () => {
    expect(isContactFresh({ updated_at: minutesAgo(-5) }, NOW)).toBe(false);
  });
});

describe("pickNoticeEmail", () => {
  test("a verified session address wins over whatever the browser sent", () => {
    expect(
      pickNoticeEmail({
        hasToken: true,
        sessionEmail: "Ana@Example.com",
        inputEmail: "victim@example.com",
      }),
    ).toBe("ana@example.com");
  });

  test("a token whose session has no address picks nothing, never the input", () => {
    expect(
      pickNoticeEmail({
        hasToken: true,
        sessionEmail: null,
        inputEmail: "victim@example.com",
      }),
    ).toBeNull();
  });

  test("a guest uses the address of the step, trimmed and lowercased", () => {
    expect(
      pickNoticeEmail({
        hasToken: false,
        sessionEmail: null,
        inputEmail: "  Maria@Example.COM ",
      }),
    ).toBe("maria@example.com");
  });

  test("a guest with no usable address picks nothing", () => {
    for (const inputEmail of ["", "   ", "not-an-email", 42, null, undefined]) {
      expect(
        pickNoticeEmail({ hasToken: false, sessionEmail: null, inputEmail }),
      ).toBeNull();
    }
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
