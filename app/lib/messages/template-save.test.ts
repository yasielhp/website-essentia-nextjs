import { describe, expect, it } from "bun:test";
import { template } from "@/lib/campaigns/whatsapp-fixtures";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";
import { whatsappSaveIssue } from "./template-save";

const SOURCES: WhatsAppParamSource[] = [
  { kind: "field", field: "first_name" },
  { kind: "static", value: "Essentia" },
];
const OK = template({ id: "tpl-1", param_count: 2 });
const dynamic = (over = {}) =>
  template({
    id: "tpl-1",
    param_count: 2,
    buttons: [{ type: "URL", text: "Ver", url: "https://example.com/{{1}}" }],
    ...over,
  });

describe("whatsappSaveIssue", () => {
  it("accepts a template that can be sent with these parameters", () => {
    expect(whatsappSaveIssue(OK, "es", SOURCES)).toBeNull();
  });

  it("accepts buttons that need nothing: a fixed address, a quick reply", () => {
    const plain = template({
      id: "tpl-1",
      param_count: 2,
      buttons: [
        { type: "URL", text: "Web", url: "https://example.com/" },
        { type: "QUICK_REPLY", text: "Vale" },
      ],
    });
    expect(whatsappSaveIssue(plain, "es", SOURCES)).toBeNull();
  });

  it("refuses a template whose button needs a value, on the template", () => {
    expect(whatsappSaveIssue(dynamic(), "es", SOURCES)).toEqual({
      field: "whatsappTemplateId",
      key: "templateButtonValue",
    });
  });

  it("the same rule the sender uses: nothing here is a second copy of it", async () => {
    // A template the save lets through is one the sender will not skip for
    // `button_params`, and the other way round.
    const { decideClientWhatsApp } =
      await import("@/lib/whatsapp/client-decision");
    const contact = {
      first_name: "Ana",
      last_name: null,
      phone: "600112233",
      preferred_language: "es",
      whatsapp_opted_in_at: "2026-11-01T00:00:00Z",
      whatsapp_opted_out_at: null,
      whatsapp_unreachable_at: null,
    };
    const booking = {
      first_name: "Ana",
      last_name: null,
      phone: null,
      service_title: "Drenaje",
      tier_label: null,
      date: "2026-12-10",
      time: "09:30",
    };
    for (const t of [OK, dynamic()]) {
      const saved = whatsappSaveIssue(t, "es", SOURCES) === null;
      const sent = decideClientWhatsApp({
        key: "booking_confirmed",
        locale: "es",
        row: {
          enabled: true,
          whatsapp_template_id: t.id,
          whatsapp_params: SOURCES,
        },
        template: t,
        contact,
        booking,
        phoneSuppressed: false,
      });
      expect(saved).toBe(sent.kind === "send");
    }
  });

  it("the other reasons keep their own answers", () => {
    expect(whatsappSaveIssue(null, "es", SOURCES)).toEqual({
      field: "whatsappTemplateId",
      key: "templateUnavailable",
    });
    expect(
      whatsappSaveIssue(
        template({ status: "PENDING", param_count: 2 }),
        "es",
        SOURCES,
      ),
    ).toEqual({ field: "whatsappTemplateId", key: "templateUnavailable" });
    expect(whatsappSaveIssue(OK, "en", SOURCES)).toEqual({
      field: "whatsappTemplateId",
      key: "templateUnavailable",
    });
    expect(whatsappSaveIssue(OK, "es", [])).toEqual({
      field: "whatsappParams",
      key: "paramCountMismatch",
    });
  });

  it("a template that is unavailable is said so before its buttons are looked at", () => {
    expect(
      whatsappSaveIssue(dynamic({ status: "REJECTED" }), "es", SOURCES),
    ).toEqual({
      field: "whatsappTemplateId",
      key: "templateUnavailable",
    });
  });

  it("a variable button is said before a wrong parameter count: fix the template first", () => {
    expect(whatsappSaveIssue(dynamic(), "es", [])).toEqual({
      field: "whatsappTemplateId",
      key: "templateButtonValue",
    });
  });
});
