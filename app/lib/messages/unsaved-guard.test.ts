import { describe, expect, test } from "bun:test";
import { shouldGuardClick } from "./unsaved-guard";

const base = {
  href: "/dashboard/settings#settings-messages",
  origin: "https://app.example.com",
  currentPath: "/dashboard/settings/messages/email/booking_confirmed/es",
  button: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  target: null,
  download: false,
  defaultPrevented: false,
};

describe("shouldGuardClick", () => {
  test("a plain click on a link inside the app is guarded", () => {
    expect(shouldGuardClick(base)).toEqual({
      guard: true,
      to: "/dashboard/settings#settings-messages",
    });
    expect(
      shouldGuardClick({
        ...base,
        href: "https://app.example.com/dashboard/users",
      }),
    ).toEqual({ guard: true, to: "/dashboard/users" });
  });
  test("the way back to the list in Settings (another page, with an anchor) is guarded, and the anchor is kept", () => {
    expect(shouldGuardClick(base)).toEqual({
      guard: true,
      to: "/dashboard/settings#settings-messages",
    });
  });
  test("a link to another site is the browser's: beforeunload asks about it", () => {
    expect(
      shouldGuardClick({ ...base, href: "https://other.example.org/x" }),
    ).toEqual({ guard: false });
    expect(shouldGuardClick({ ...base, href: "mailto:a@b.c" })).toEqual({
      guard: false,
    });
    expect(shouldGuardClick({ ...base, href: "tel:+34600" })).toEqual({
      guard: false,
    });
  });
  test("opening in a new tab or window leaves this page as it is", () => {
    for (const key of ["ctrlKey", "metaKey", "shiftKey", "altKey"] as const) {
      expect(shouldGuardClick({ ...base, [key]: true })).toEqual({
        guard: false,
      });
    }
    expect(shouldGuardClick({ ...base, button: 1 })).toEqual({ guard: false });
    expect(shouldGuardClick({ ...base, target: "_blank" })).toEqual({
      guard: false,
    });
    expect(shouldGuardClick({ ...base, download: true })).toEqual({
      guard: false,
    });
  });
  test("a click something else already handled is not ours", () => {
    expect(shouldGuardClick({ ...base, defaultPrevented: true })).toEqual({
      guard: false,
    });
  });
  test("a link to this very page, or to an anchor in it, goes nowhere and asks nothing", () => {
    expect(shouldGuardClick({ ...base, href: base.currentPath })).toEqual({
      guard: false,
    });
    expect(shouldGuardClick({ ...base, href: "#message-body-label" })).toEqual({
      guard: false,
    });
    expect(
      shouldGuardClick({ ...base, href: `${base.currentPath}#x` }),
    ).toEqual({ guard: false });
  });
  test("no address, or one that is not a URL, is not guarded", () => {
    expect(shouldGuardClick({ ...base, href: "" })).toEqual({ guard: false });
    expect(shouldGuardClick({ ...base, href: null })).toEqual({ guard: false });
  });
});
