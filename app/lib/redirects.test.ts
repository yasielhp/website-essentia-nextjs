import { describe, expect, test } from "bun:test";
import {
  messageListHref,
  whatsappTemplatesHref,
} from "./messages/message-route";
import { dashboardMessagesRedirects } from "./redirects";

/** What Next does with these sources: the first that matches the path (and the query it asks for) wins. */
function follow(
  pathname: string,
  query: Record<string, string> = {},
): string | null {
  for (const rule of dashboardMessagesRedirects) {
    const asked = (rule.has ?? []).every((h) => query[h.key] === h.value);
    if (!asked) continue;
    if (rule.source.endsWith("/:path*")) {
      const base = rule.source.slice(0, -"/:path*".length);
      if (pathname.startsWith(`${base}/`)) {
        return rule.destination.replace(
          ":path*",
          pathname.slice(base.length + 1),
        );
      }
    } else if (pathname === rule.source) {
      return rule.destination;
    }
  }
  return null;
}

describe("the old addresses of Messages", () => {
  test("every one is permanent (308), so the old address leaves the index and the bookmarks follow", () => {
    expect(dashboardMessagesRedirects.length).toBe(3);
    for (const r of dashboardMessagesRedirects) expect(r.permanent).toBe(true);
  });

  test("the list goes to the automatic messages card of Settings, the same address the rest of the app uses", () => {
    expect(follow("/dashboard/messages")).toBe(
      "/dashboard/settings#settings-messages",
    );
    expect(follow("/dashboard/messages")).toBe(messageListHref());
    // The old emails tab, and any other value of the tab.
    expect(follow("/dashboard/messages", { tab: "email" })).toBe(
      messageListHref(),
    );
    expect(follow("/dashboard/messages", { tab: "other" })).toBe(
      messageListHref(),
    );
  });

  test("?tab=whatsapp goes to the templates card: the most specific rule comes first", () => {
    expect(follow("/dashboard/messages", { tab: "whatsapp" })).toBe(
      "/dashboard/settings#settings-whatsapp-templates",
    );
    expect(follow("/dashboard/messages", { tab: "whatsapp" })).toBe(
      whatsappTemplatesHref(),
    );
    const [first] = dashboardMessagesRedirects;
    expect(first?.has).toEqual([
      { type: "query", key: "tab", value: "whatsapp" },
    ]);
  });

  test("a message's own page keeps its tail: channel, key and language", () => {
    expect(follow("/dashboard/messages/email/booking_confirmed/es")).toBe(
      "/dashboard/settings/messages/email/booking_confirmed/es",
    );
    expect(follow("/dashboard/messages/whatsapp/booking_paid/en")).toBe(
      "/dashboard/settings/messages/whatsapp/booking_paid/en",
    );
  });

  test("the new addresses are not redirected again: nothing loops", () => {
    for (const path of [
      "/dashboard/settings",
      "/dashboard/settings/messages/email/booking_confirmed/es",
      "/dashboard/messagesx",
    ]) {
      expect(follow(path)).toBeNull();
    }
    for (const r of dashboardMessagesRedirects) {
      expect(r.destination.startsWith("/dashboard/settings")).toBe(true);
      expect(r.destination).not.toContain("/dashboard/messages");
    }
  });
});
