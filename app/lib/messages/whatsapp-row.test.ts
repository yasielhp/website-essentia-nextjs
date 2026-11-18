import { describe, expect, it } from "bun:test";
import { template } from "@/lib/campaigns/whatsapp-fixtures";
import {
  WHATSAPP_MESSAGE_KEYS,
  hasDynamicUrlButton,
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
  it("are the two instant confirmations (the reminder is an appointment notice now)", () => {
    expect([...WHATSAPP_MESSAGE_KEYS].sort()).toEqual([
      "booking_confirmed",
      "booking_paid",
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

  it("the switch is not the status: a row that is switched off is read as what it is set up as", () => {
    expect(whatsappRowState(saved({ enabled: false }), [good], "es")).toEqual({
      kind: "configured",
      templateName: "cita_confirmada",
    });
    expect(
      whatsappRowState(
        saved({ enabled: false, whatsapp_template_id: null }),
        [good],
        "es",
      ),
    ).toEqual({ kind: "none" });
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
