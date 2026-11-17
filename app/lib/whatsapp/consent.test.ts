import { describe, expect, test } from "bun:test";
import {
  consentTarget,
  NOTICE_CONSENT_WINDOW_MS,
  marketingNotes,
  marketingRowState,
  isContactFresh,
  marketingConsentActive,
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

describe("consentTarget", () => {
  test("a signed-in client booking with her own address is her own contact", () => {
    expect(
      consentTarget({
        signedIn: true,
        sessionEmail: "Ana@Example.com",
        formEmail: "  ana@EXAMPLE.com ",
      }),
    ).toEqual({ email: "ana@example.com", own: true });
  });

  test("a signed-in caller who typed another address is not writing her own contact", () => {
    expect(
      consentTarget({
        signedIn: true,
        sessionEmail: "staff@example.com",
        formEmail: "Client@Example.com",
      }),
    ).toEqual({ email: "client@example.com", own: false });
  });

  test("a session with no address owns nothing: the form's address, as a guest's", () => {
    expect(
      consentTarget({
        signedIn: true,
        sessionEmail: null,
        formEmail: "client@example.com",
      }),
    ).toEqual({ email: "client@example.com", own: false });
  });

  test("a signed-in caller with no usable address in the form targets nobody, not even herself", () => {
    for (const formEmail of ["", "   ", "not-an-email", 42, null, undefined]) {
      expect(
        consentTarget({
          signedIn: true,
          sessionEmail: "ana@example.com",
          formEmail,
        }),
      ).toEqual({ email: null, own: false });
    }
  });

  test("a guest uses the address of the step, trimmed and lowercased, and owns nothing", () => {
    expect(
      consentTarget({
        signedIn: false,
        sessionEmail: null,
        formEmail: "  Maria@Example.COM ",
      }),
    ).toEqual({ email: "maria@example.com", own: false });
    // A session address handed in without a session is not one.
    expect(
      consentTarget({
        signedIn: false,
        sessionEmail: "maria@example.com",
        formEmail: "maria@example.com",
      }),
    ).toEqual({ email: "maria@example.com", own: false });
  });

  test("a guest with no usable address targets nobody", () => {
    for (const formEmail of ["", "   ", "not-an-email", 42, null, undefined]) {
      expect(
        consentTarget({ signedIn: false, sessionEmail: null, formEmail }),
      ).toEqual({ email: null, own: false });
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

describe("marketingRowState", () => {
  const both = {
    newsletter_subscribed: true,
    newsletter_unsubscribed_at: null,
    whatsapp_marketing_opted_in_at: IN,
    whatsapp_opted_out_at: null,
  };

  test("on only when email AND WhatsApp are on and there is no STOP", () => {
    expect(marketingRowState(both)).toBe("on");
  });

  test("off when neither channel is", () => {
    expect(marketingRowState({})).toBe("off");
    expect(
      marketingRowState({
        newsletter_subscribed: false,
        whatsapp_marketing_opted_in_at: null,
      }),
    ).toBe("off");
  });

  test("only the email channel is email_only, and the switch is not on", () => {
    expect(
      marketingRowState({ ...both, whatsapp_marketing_opted_in_at: null }),
    ).toBe("email_only");
  });

  test("only the WhatsApp channel is whatsapp_only", () => {
    expect(marketingRowState({ ...both, newsletter_subscribed: false })).toBe(
      "whatsapp_only",
    );
    expect(marketingRowState({ ...both, newsletter_subscribed: null })).toBe(
      "whatsapp_only",
    );
  });

  test("an email unsubscribe counts as the email channel being off", () => {
    expect(
      marketingRowState({ ...both, newsletter_unsubscribed_at: OUT }),
    ).toBe("whatsapp_only");
  });

  test("a global STOP wins over every other state, however many dates are stored", () => {
    expect(marketingRowState({ ...both, whatsapp_opted_out_at: OUT })).toBe(
      "opted_out",
    );
    expect(marketingRowState({ whatsapp_opted_out_at: OUT })).toBe("opted_out");
  });
});

describe("marketingNotes", () => {
  test("a contact the email can reach has no notes", () => {
    expect(
      marketingNotes({
        email: "a@b.co",
        email_bounced_at: null,
        newsletter_subscribed: true,
      }),
    ).toEqual([]);
  });

  test("no email, a bounce and the contact's own unsubscribe each explain themselves", () => {
    expect(marketingNotes({ email: null })).toEqual(["no_email"]);
    expect(marketingNotes({ email: "  " })).toEqual(["no_email"]);
    expect(marketingNotes({ email: "a@b.co", email_bounced_at: OUT })).toEqual([
      "bounced",
    ]);
    expect(
      marketingNotes({
        email: "a@b.co",
        newsletter_subscribed: false,
        newsletter_unsubscribed_at: OUT,
      }),
    ).toEqual(["email_unsubscribed"]);
  });

  test("an unsubscribe date on a contact who is subscribed again is not a note", () => {
    expect(
      marketingNotes({
        email: "a@b.co",
        newsletter_subscribed: true,
        newsletter_unsubscribed_at: OUT,
      }),
    ).toEqual([]);
  });
});
