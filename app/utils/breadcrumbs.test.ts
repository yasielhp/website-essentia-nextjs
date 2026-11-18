import { describe, expect, test } from "bun:test";
import { getBreadcrumbs } from "./breadcrumbs";

// "Settings" leads back to the card the page came from.
const SETTINGS = {
  key: "sections.settings",
  href: "/dashboard/settings#settings-messages",
};

describe("the crumbs of a message's own page: Settings, the message", () => {
  test("Settings (back to its card of messages), then the message", () => {
    expect(
      getBreadcrumbs("/dashboard/settings/messages/email/booking_confirmed/es"),
    ).toEqual([
      SETTINGS,
      {
        messageRow: {
          channel: "email",
          key: "booking_confirmed",
          locale: "es",
        },
      },
    ]);
  });
  test("a WhatsApp page says so", () => {
    expect(
      getBreadcrumbs("/dashboard/settings/messages/whatsapp/booking_paid/en"),
    ).toEqual([
      SETTINGS,
      {
        messageRow: { channel: "whatsapp", key: "booking_paid", locale: "en" },
      },
    ]);
  });
  test("a trailing slash changes nothing", () => {
    expect(
      getBreadcrumbs(
        "/dashboard/settings/messages/email/booking_confirmed/es/",
      ),
    ).toHaveLength(2);
  });
  test("an address that is no page has no message crumb", () => {
    for (const path of [
      "/dashboard/settings/messages/email/nope/es",
      "/dashboard/settings/messages/email/booking_reminder/en",
      "/dashboard/settings/messages/whatsapp/booking_received/es",
    ]) {
      const crumbs = getBreadcrumbs(path);
      expect(crumbs.some((c) => "messageRow" in c)).toBe(false);
    }
  });
});

describe("the list of messages is a card of Settings, not a page", () => {
  test("Settings itself is one crumb: there is no Messages section or page to name", () => {
    expect(getBreadcrumbs("/dashboard/settings")).toEqual([
      { key: "sections.settings" },
    ]);
    for (const path of [
      "/dashboard/messages",
      "/dashboard/settings/messages",
    ]) {
      expect(
        getBreadcrumbs(path).every((c) => c.key !== "sections.messages"),
      ).toBe(true);
    }
  });
  test("the word Messages is no crumb of the message pages either", () => {
    for (const crumb of getBreadcrumbs(
      "/dashboard/settings/messages/email/booking_confirmed/es",
    )) {
      expect(crumb.key).not.toBe("sections.messages");
    }
  });
});

describe("the other sections are as they were", () => {
  test("Settings itself, its other pages, a sub-list and the overview", () => {
    expect(getBreadcrumbs("/dashboard/settings")).toEqual([
      { key: "sections.settings" },
    ]);
    expect(getBreadcrumbs("/dashboard/campaigns/segments")).toEqual([
      { key: "sections.campaigns", href: "/dashboard/campaigns" },
      { key: "leaves.segments" },
    ]);
    expect(getBreadcrumbs("/dashboard")).toEqual([
      { key: "sections.overview" },
    ]);
  });
});
