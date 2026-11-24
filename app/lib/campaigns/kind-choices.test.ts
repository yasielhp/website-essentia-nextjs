import { describe, expect, test } from "bun:test";
import type { CampaignKind } from "@/types/campaign";
import { kindChoices } from "./kind-choices";

const ORDER: CampaignKind[] = [
  "standard",
  "automated",
  "autoresponder",
  "split",
  "rss",
  "dateBased",
  "appointment",
];
const ALL: CampaignKind[] = ORDER;
const choose = (over: Partial<Parameters<typeof kindChoices>[0]> = {}) =>
  kindChoices({
    order: ORDER,
    implemented: ALL,
    channel: "email",
    saved: false,
    savedKind: null,
    ...over,
  });

describe("kindChoices: what the type select offers", () => {
  test("email: every kind it can be, in order, none of the WhatsApp-only ones", () => {
    expect(choose().map((c) => c.kind)).toEqual([
      "standard",
      "automated",
      "autoresponder",
      "split",
      "rss",
      "dateBased",
    ]);
  });

  test("WhatsApp: the ones it can be, including the appointment notice; not A/B or RSS", () => {
    const kinds = choose({ channel: "whatsapp" }).map((c) => c.kind);
    expect(kinds).toContain("appointment");
    expect(kinds).not.toContain("split");
    expect(kinds).not.toContain("rss");
  });

  test("a kind that is not in the channel is not shown at all, not greyed", () => {
    expect(choose().some((c) => c.kind === "appointment")).toBe(false);
  });

  test("everything offered can be picked on a new campaign", () => {
    for (const c of choose())
      expect(c).toMatchObject({ implemented: true, available: true });
  });

  test("a kind that does not exist yet is shown, greyed, as coming soon", () => {
    const rows = choose({ implemented: ["standard"] });
    expect(rows.find((c) => c.kind === "standard")).toMatchObject({
      available: true,
    });
    expect(rows.find((c) => c.kind === "automated")).toMatchObject({
      implemented: false,
      available: false,
    });
  });

  test("a saved campaign cannot become an appointment notice, or stop being one", () => {
    const standard = choose({
      channel: "whatsapp",
      saved: true,
      savedKind: "standard",
    });
    expect(standard.find((c) => c.kind === "appointment")?.available).toBe(
      false,
    );
    expect(standard.find((c) => c.kind === "automated")?.available).toBe(true);
    const notice = choose({
      channel: "whatsapp",
      saved: true,
      savedKind: "appointment",
    });
    expect(notice.find((c) => c.kind === "standard")?.available).toBe(false);
    expect(notice.find((c) => c.kind === "appointment")?.available).toBe(true);
  });

  test("an unsaved campaign has no such lock, whatever kind it was last set to", () => {
    for (const c of choose({
      channel: "whatsapp",
      saved: false,
      savedKind: "standard",
    })) {
      expect(c.available).toBe(true);
    }
  });
});
