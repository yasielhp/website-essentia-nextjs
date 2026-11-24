import { describe, expect, test } from "bun:test";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";
import {
  PARAM_FIELDS,
  fieldAvailable,
  fitParams,
  kindAllowedForChannel,
  kindsForChannel,
  partitionTemplates,
  sampleParams,
  triggerEventKey,
  unavailableParams,
  visitFieldsExist,
  WHATSAPP_MESSAGES_PER_RUN,
} from "./whatsapp-form";
import { BUDGET_MS, PER_SECOND } from "./dispatch-whatsapp";
import { template } from "./whatsapp-fixtures";
import { campaignTemplateChoiceIssue } from "./whatsapp-eligibility";

const field = (f: WhatsAppParamSource & { kind: "field" }) => f;
const first: WhatsAppParamSource = field({
  kind: "field",
  field: "first_name",
});
const date: WhatsAppParamSource = field({ kind: "field", field: "date" });
const fixed = (value: string): WhatsAppParamSource => ({
  kind: "static",
  value,
});

describe("kindAllowedForChannel", () => {
  test("every kind can be an email", () => {
    for (const kind of [
      "standard",
      "automated",
      "autoresponder",
      "split",
      "rss",
      "dateBased",
    ] as const) {
      expect(kindAllowedForChannel(kind, "email")).toBe(true);
    }
  });
  test("a template has no A/B test and no dynamic link", () => {
    expect(kindAllowedForChannel("split", "whatsapp")).toBe(false);
    expect(kindAllowedForChannel("rss", "whatsapp")).toBe(false);
  });
  test("the other kinds work on WhatsApp", () => {
    for (const kind of [
      "standard",
      "automated",
      "autoresponder",
      "dateBased",
    ] as const) {
      expect(kindAllowedForChannel(kind, "whatsapp")).toBe(true);
    }
  });
});

describe("kindsForChannel", () => {
  const ALL = [
    "standard",
    "automated",
    "autoresponder",
    "split",
    "rss",
    "dateBased",
  ] as const;

  test("an email offers every kind, in the order given", () => {
    expect(kindsForChannel(ALL, "email")).toEqual([...ALL]);
  });

  test("WhatsApp offers four: the two a template cannot be are not listed at all", () => {
    expect(kindsForChannel(ALL, "whatsapp")).toEqual([
      "standard",
      "automated",
      "autoresponder",
      "dateBased",
    ]);
  });

  test("is the same rule the server applies: nothing listed is refused, nothing refused is listed", () => {
    for (const channel of ["email", "whatsapp"] as const) {
      const listed = kindsForChannel(ALL, channel);
      for (const kind of ALL) {
        expect(listed.includes(kind)).toBe(
          kindAllowedForChannel(kind, channel),
        );
      }
    }
  });

  test("keeps whatever order and subset it is handed", () => {
    expect(kindsForChannel(["rss", "standard"], "whatsapp")).toEqual([
      "standard",
    ]);
    expect(kindsForChannel([], "whatsapp")).toEqual([]);
  });
});

describe("visitFieldsExist", () => {
  test("only the booking rules know which visit a message is about", () => {
    expect(visitFieldsExist("automated", { event: "after_booking" })).toBe(
      true,
    );
    expect(visitFieldsExist("automated", { event: "first_visit" })).toBe(true);
  });
  test("a one-off send, a segment entry or a birthday knows none", () => {
    expect(visitFieldsExist("standard", {})).toBe(false);
    expect(visitFieldsExist("automated", { event: "segment_entry" })).toBe(
      false,
    );
    expect(
      visitFieldsExist("autoresponder", { event: "newsletter_subscribed" }),
    ).toBe(false);
    expect(visitFieldsExist("dateBased", { event: "birthday" })).toBe(false);
  });
});

describe("fieldAvailable", () => {
  test("the contact's name is always there", () => {
    expect(fieldAvailable("first_name", "standard", {})).toBe(true);
    expect(fieldAvailable("last_name", "standard", {})).toBe(true);
  });
  test("service, session type, date and time need a visit", () => {
    for (const f of ["service", "session_type", "date", "time"] as const) {
      expect(fieldAvailable(f, "standard", {})).toBe(false);
      expect(fieldAvailable(f, "automated", { event: "after_booking" })).toBe(
        true,
      );
    }
  });
  test("the post fields are never offered", () => {
    expect(PARAM_FIELDS).not.toContain("post_title");
    expect(PARAM_FIELDS).not.toContain("post_url");
    expect(
      fieldAvailable("post_url", "automated", { event: "after_booking" }),
    ).toBe(false);
  });
});

describe("unavailableParams", () => {
  test("lists the positions that would read as a dash", () => {
    expect(
      unavailableParams([first, date, fixed("x")], "standard", {}),
    ).toEqual([1]);
  });
  test("nothing is missing when the rule supplies the visit", () => {
    expect(
      unavailableParams([first, date], "automated", { event: "first_visit" }),
    ).toEqual([]);
  });
  test("a fixed text is always available", () => {
    expect(unavailableParams([fixed("")], "standard", {})).toEqual([]);
  });
});

describe("fitParams", () => {
  test("keeps what is there and pads with empty fixed texts", () => {
    expect(fitParams([first], 3)).toEqual([first, fixed(""), fixed("")]);
  });
  test("cuts the extra ones", () => {
    expect(fitParams([first, date, fixed("x")], 1)).toEqual([first]);
  });
  test("a template with no parameters needs none", () => {
    expect(fitParams([first], 0)).toEqual([]);
  });
  test("returns the same sources when the count already fits", () => {
    const sources = [first, date];
    expect(fitParams(sources, 2)).toBe(sources);
  });
});

describe("partitionTemplates", () => {
  const ok = template({ id: "ok" });
  const pending = template({ id: "pending", status: "PENDING" });
  const media = template({ id: "media", unsupported_reason: "media_header" });
  const english = template({ id: "en", language: "en" });
  const rejected = template({ id: "rej", status: "REJECTED" });

  test("offers only what can be sent in the campaign's language", () => {
    const { eligible } = partitionTemplates(
      [pending, ok, media, english, rejected],
      "es",
    );
    expect(eligible.map((t) => t.id)).toEqual(["ok"]);
  });
  test("counts why the others do not qualify", () => {
    const { excluded } = partitionTemplates(
      [pending, ok, media, english, rejected],
      "es",
    );
    expect(excluded).toEqual({
      template_not_approved: 2,
      template_unsupported: 1,
      template_language: 1,
    });
  });
  test("the unsupported reasons are kept for the explanation", () => {
    const { unsupportedReasons } = partitionTemplates([media], "es");
    expect(unsupportedReasons).toEqual(["media_header"]);
  });
  test("the same templates qualify in the other language", () => {
    const { eligible } = partitionTemplates([ok, english], "en");
    expect(eligible.map((t) => t.id)).toEqual(["en"]);
  });
  test("nothing at all is an empty answer", () => {
    expect(partitionTemplates([], "es")).toEqual({
      eligible: [],
      excluded: {},
      unsupportedReasons: [],
    });
  });
});

describe("sampleParams", () => {
  const today = new Date(2026, 11, 14);
  test("fills what the contact has with an example person", () => {
    expect(
      sampleParams([first, fixed("hola")], "es", "standard", {}, today),
    ).toEqual(["Ana", "hola"]);
    expect(sampleParams([first], "en", "standard", {}, today)).toEqual([
      "Anna",
    ]);
  });
  test("a visit field is a dash where no visit exists, as it will be sent", () => {
    expect(sampleParams([date], "es", "standard", {}, today)).toEqual(["—"]);
  });
  test("with a booking rule the visit has example values", () => {
    const [value] = sampleParams(
      [date],
      "es",
      "automated",
      { event: "after_booking" },
      today,
    );
    expect(value).toContain("2026");
    expect(value).not.toBe("—");
    expect(
      sampleParams(
        [field({ kind: "field", field: "time" })],
        "es",
        "automated",
        { event: "first_visit" },
        today,
      ),
    ).toEqual(["10:30"]);
  });
  test("an empty fixed text is shown as the dash Meta will get", () => {
    expect(sampleParams([fixed("  ")], "es", "standard", {}, today)).toEqual([
      "—",
    ]);
  });
});

describe("WHATSAPP_MESSAGES_PER_RUN", () => {
  test("is what one run of the sender can send", () => {
    expect(WHATSAPP_MESSAGES_PER_RUN).toBe((PER_SECOND * BUDGET_MS) / 1000);
  });
});

describe("triggerEventKey", () => {
  test("a sign-up on WhatsApp is a consent, with its own words", () => {
    expect(triggerEventKey("newsletter_subscribed", "whatsapp")).toBe(
      "newsletter_subscribedWhatsApp",
    );
  });
  test("every other event, and every email, keeps its key", () => {
    expect(triggerEventKey("newsletter_subscribed", "email")).toBe(
      "newsletter_subscribed",
    );
    for (const event of [
      "segment_entry",
      "after_booking",
      "first_visit",
    ] as const) {
      expect(triggerEventKey(event, "whatsapp")).toBe(event);
    }
  });
});

describe("an appointment notice", () => {
  const before = { event: "before_visit" as const, hours: 48 };
  const after = { event: "after_visit" as const, hours: 2 };

  test("is a kind only WhatsApp offers", () => {
    expect(kindAllowedForChannel("appointment", "whatsapp")).toBe(true);
    expect(kindAllowedForChannel("appointment", "email")).toBe(false);
    const all = [
      "standard",
      "automated",
      "autoresponder",
      "split",
      "rss",
      "dateBased",
      "appointment",
    ] as const;
    expect(kindsForChannel(all, "whatsapp")).toEqual([
      "standard",
      "automated",
      "autoresponder",
      "dateBased",
      "appointment",
    ]);
    expect(kindsForChannel(all, "email")).not.toContain("appointment");
  });

  test("talks about THAT appointment: service, session type, date and time exist", () => {
    for (const trigger of [before, after]) {
      expect(visitFieldsExist("appointment", trigger)).toBe(true);
      for (const field of [
        "service",
        "session_type",
        "date",
        "time",
      ] as const) {
        expect(fieldAvailable(field, "appointment", trigger)).toBe(true);
      }
    }
  });

  test("so none of its parameters reads as a dash", () => {
    const params: WhatsAppParamSource[] = [
      field({ kind: "field", field: "first_name" }),
      field({ kind: "field", field: "service" }),
      field({ kind: "field", field: "date" }),
      field({ kind: "field", field: "time" }),
    ];
    expect(unavailableParams(params, "appointment", before)).toEqual([]);
  });

  test("the post's title and link are never offered, nor available", () => {
    expect(PARAM_FIELDS).not.toContain("post_title");
    expect(fieldAvailable("post_url", "appointment", before)).toBe(false);
    expect(fieldAvailable("post_title", "appointment", after)).toBe(false);
  });

  test("the sample shows a real date and time, as it will send", () => {
    const out = sampleParams(
      [field({ kind: "field", field: "time" })],
      "es",
      "appointment",
      before,
      new Date(2026, 11, 14),
    );
    expect(out).toEqual(["10:30"]);
  });
});

describe("partitionTemplates for an appointment notice", () => {
  const marketing = template({ id: "mkt" });
  const utility = template({ id: "utl", category: "UTILITY" });
  const pending = template({
    id: "pending",
    category: "UTILITY",
    status: "PENDING",
  });

  test("leaves the Marketing ones out, counted under their own reason", () => {
    const out = partitionTemplates(
      [marketing, utility, pending],
      "es",
      "appointment",
    );
    expect(out.eligible.map((t) => t.id)).toEqual(["utl"]);
    expect(out.excluded).toEqual({
      template_category: 1,
      template_not_approved: 1,
    });
  });
  test("for any other kind, or none, a Marketing template is offered as before", () => {
    for (const kind of [undefined, "standard", "automated"] as const) {
      const out = partitionTemplates([marketing, utility], "es", kind);
      expect(out.eligible.map((t) => t.id)).toEqual(["mkt", "utl"]);
      expect(out.excluded).toEqual({});
    }
  });
  test("a saved choice that is Marketing is reported, not dropped: the issue names it", () => {
    expect(campaignTemplateChoiceIssue(marketing, "es", "appointment")).toBe(
      "template_category",
    );
  });
});
