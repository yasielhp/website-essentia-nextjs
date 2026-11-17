import { describe, expect, it } from "bun:test";
import { template } from "@/lib/campaigns/whatsapp-fixtures";
import {
  WHATSAPP_MESSAGE_KEYS,
  hasDynamicUrlButton,
  isFirstReminderSetup,
  messageParamFields,
  messageTemplateChoices,
  whatsappRowState,
  type SavedWhatsAppRow,
} from "./whatsapp-row";

const saved = (over: Partial<SavedWhatsAppRow> = {}): SavedWhatsAppRow => ({
  enabled: true,
  whatsapp_template_id: "tpl-1",
  whatsapp_params: [
    { kind: "field", field: "first_name" },
    { kind: "static", value: "x" },
  ],
  ...over,
});

describe("WHATSAPP_MESSAGE_KEYS", () => {
  it("are the three the booking-notice opt-in promises", () => {
    expect([...WHATSAPP_MESSAGE_KEYS].sort()).toEqual([
      "booking_confirmed",
      "booking_paid",
      "booking_reminder",
    ]);
  });
});

describe("messageParamFields", () => {
  it("offers a message the fields its variables map to", () => {
    expect(messageParamFields("booking_confirmed")).toEqual([
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
    ]);
  });
  it("the paid confirmation has no session type", () => {
    expect(messageParamFields("booking_paid")).not.toContain("session_type");
  });
});

describe("hasDynamicUrlButton", () => {
  it("a link with a variable needs a value this send does not fill", () => {
    const t = template({
      buttons: [{ type: "URL", text: "Ver", url: "https://x.test/{{1}}" }],
    });
    expect(hasDynamicUrlButton(t)).toBe(true);
  });
  it("a fixed link, a quick reply or no button is fine", () => {
    expect(
      hasDynamicUrlButton(
        template({
          buttons: [{ type: "URL", text: "Ver", url: "https://x.test/a" }],
        }),
      ),
    ).toBe(false);
    expect(
      hasDynamicUrlButton(
        template({ buttons: [{ type: "QUICK_REPLY", text: "Ok" }] }),
      ),
    ).toBe(false);
    expect(hasDynamicUrlButton(template({ buttons: [] }))).toBe(false);
  });
});

describe("messageTemplateChoices", () => {
  const ok = template({ id: "ok" });
  const dynamic = template({
    id: "dyn",
    buttons: [{ type: "URL", text: "Ver", url: "https://x.test/{{1}}" }],
  });
  const pending = template({ id: "p", status: "PENDING" });
  const english = template({ id: "en", language: "en" });

  it("offers the approved ones in the row's language, without a variable link", () => {
    const { eligible } = messageTemplateChoices(
      [ok, dynamic, pending, english],
      "es",
    );
    expect(eligible.map((t) => t.id)).toEqual(["ok"]);
  });

  it("counts the ones left out, and says how many had a variable link", () => {
    const out = messageTemplateChoices([ok, dynamic, pending, english], "es");
    expect(out.excluded).toEqual({
      template_not_approved: 1,
      template_language: 1,
    });
    expect(out.dynamicUrl).toBe(1);
  });

  it("the other language offers the other template", () => {
    expect(
      messageTemplateChoices([ok, english], "en").eligible.map((t) => t.id),
    ).toEqual(["en"]);
  });
});

describe("whatsappRowState", () => {
  const good = template({ id: "tpl-1", name: "cita_confirmada" });

  it("with nothing saved, nothing is sent", () => {
    expect(whatsappRowState(undefined, [good], "es")).toEqual({ kind: "none" });
  });

  it("a row with no template chosen is not configured", () => {
    expect(
      whatsappRowState(saved({ whatsapp_template_id: null }), [good], "es"),
    ).toEqual({ kind: "none" });
  });

  it("a row switched off says so and sends nothing", () => {
    expect(whatsappRowState(saved({ enabled: false }), [good], "es")).toEqual({
      kind: "off",
    });
  });

  it("a template that can go out is configured, by name", () => {
    expect(whatsappRowState(saved(), [good], "es")).toEqual({
      kind: "configured",
      templateName: "cita_confirmada",
    });
  });

  it("a template paused since says why it is not valid", () => {
    expect(
      whatsappRowState(
        saved(),
        [template({ id: "tpl-1", status: "PAUSED" })],
        "es",
      ),
    ).toEqual({ kind: "invalid", issue: "template_not_approved" });
  });

  it("a template that was deleted is missing", () => {
    expect(whatsappRowState(saved(), [], "es")).toEqual({
      kind: "invalid",
      issue: "template_missing",
    });
  });

  it("a template in another language than the row", () => {
    expect(whatsappRowState(saved(), [good], "en")).toEqual({
      kind: "invalid",
      issue: "template_language",
    });
  });

  it("the wrong number of parameters", () => {
    expect(
      whatsappRowState(
        saved(),
        [template({ id: "tpl-1", param_count: 3 })],
        "es",
      ),
    ).toEqual({ kind: "invalid", issue: "param_count" });
  });

  it("a template with a variable link would be refused by Meta", () => {
    const dyn = template({
      id: "tpl-1",
      buttons: [{ type: "URL", text: "Ver", url: "https://x.test/{{1}}" }],
    });
    expect(whatsappRowState(saved(), [dyn], "es")).toEqual({
      kind: "invalid",
      issue: "dynamic_url",
    });
  });

  it("when the templates could not be read the state is unknown, not invalid", () => {
    expect(whatsappRowState(saved(), null, "es")).toEqual({ kind: "unknown" });
  });
});

describe("isFirstReminderSetup", () => {
  const row = (
    key: string,
    id: string | null,
    channel = "whatsapp",
    locale = "es",
  ) => ({
    key,
    channel,
    locale,
    whatsapp_template_id: id,
  });

  it("with no WhatsApp reminder saved, saving one is the first", () => {
    expect(isFirstReminderSetup([], "es")).toBe(true);
    expect(isFirstReminderSetup([row("booking_confirmed", "t")], "es")).toBe(
      true,
    );
  });

  it("with one already chosen, it is not", () => {
    expect(isFirstReminderSetup([row("booking_reminder", "t")], "es")).toBe(
      false,
    );
  });

  it("an email row or an empty WhatsApp one does not count", () => {
    expect(
      isFirstReminderSetup([row("booking_reminder", "t", "email")], "es"),
    ).toBe(true);
    expect(isFirstReminderSetup([row("booking_reminder", null)], "es")).toBe(
      true,
    );
  });

  it("is counted per language: Spanish being set up says nothing about English", () => {
    const rows = [row("booking_reminder", "t", "whatsapp", "es")];
    expect(isFirstReminderSetup(rows, "es")).toBe(false);
    expect(isFirstReminderSetup(rows, "en")).toBe(true);
  });

  it("and once English has its own, it is no longer the first", () => {
    const rows = [
      row("booking_reminder", "t", "whatsapp", "es"),
      row("booking_reminder", "u", "whatsapp", "en"),
    ];
    expect(isFirstReminderSetup(rows, "en")).toBe(false);
  });
});
