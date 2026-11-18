import { describe, expect, test } from "bun:test";
import { dashboardMessagesRedirects } from "./redirects";

/** What Next does with a `:path*` source and destination, for the shapes used here. */
function follow(pathname: string): string | null {
  for (const { source, destination } of dashboardMessagesRedirects) {
    if (source.endsWith("/:path*")) {
      const base = source.slice(0, -"/:path*".length);
      if (pathname.startsWith(`${base}/`)) {
        return destination.replace(":path*", pathname.slice(base.length + 1));
      }
    } else if (pathname === source) {
      return destination;
    }
  }
  return null;
}

describe("the old addresses of Messages", () => {
  test("every one is permanent (308), so the old address leaves the index and the bookmarks follow", () => {
    expect(dashboardMessagesRedirects.length).toBeGreaterThan(0);
    for (const r of dashboardMessagesRedirects) expect(r.permanent).toBe(true);
  });

  test("the list goes to the list in Settings", () => {
    expect(follow("/dashboard/messages")).toBe("/dashboard/settings/messages");
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
      "/dashboard/settings/messages",
      "/dashboard/settings/messages/email/booking_confirmed/es",
      "/dashboard/settings",
      "/dashboard/messagesx",
    ]) {
      expect(follow(path)).toBeNull();
    }
    for (const r of dashboardMessagesRedirects) {
      expect(r.destination.startsWith("/dashboard/settings/messages")).toBe(
        true,
      );
    }
  });
});
