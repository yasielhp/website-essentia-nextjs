import { describe, expect, test } from "bun:test";
import en from "../../messages/en/dashboard.json";
import es from "../../messages/es/dashboard.json";
import { navIcons, navLinks } from "./nav";

describe("the sidebar", () => {
  test("Messages is not in it: it is a page of Settings, in the account menu", () => {
    expect(navLinks.map((l) => l.key)).not.toContain("messages");
    expect(navLinks.some((l) => l.href.includes("/messages"))).toBe(false);
    expect(Object.keys(navIcons)).not.toContain("messages");
  });

  test("every entry has an icon and a name in both languages, and no name or icon is left without an entry", () => {
    const keys = navLinks.map((l) => l.key).sort();
    expect(Object.keys(navIcons).sort()).toEqual(keys);
    for (const messages of [es, en]) {
      const names = messages.nav as Record<string, string>;
      for (const key of keys) expect(names[key]?.trim()).toBeTruthy();
      // `settings` is the account menu's; every other name is a sidebar entry.
      expect(
        Object.keys(names)
          .filter((k) => k !== "settings")
          .sort(),
      ).toEqual(keys);
    }
  });

  test("no entry of the sidebar is Settings or under it, so none can be marked on the pages of Messages", () => {
    for (const { href } of navLinks) {
      const underSettings =
        "/dashboard/settings/messages".startsWith(href + "/") &&
        href !== "/dashboard";
      expect(underSettings).toBe(false);
      expect(href.startsWith("/dashboard/settings")).toBe(false);
    }
  });
});
