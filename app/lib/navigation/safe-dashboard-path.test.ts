import { describe, expect, it } from "bun:test";
import { safeDashboardPath } from "./safe-dashboard-path";

describe("safeDashboardPath", () => {
  it("accepts a path inside the dashboard, query included", () => {
    expect(safeDashboardPath("/dashboard/contacts/abc?tab=bonuses")).toBe(
      "/dashboard/contacts/abc?tab=bonuses",
    );
    expect(safeDashboardPath("/dashboard")).toBe("/dashboard");
  });

  it("refuses other sites, schemes and protocol-relative URLs", () => {
    for (const bad of [
      "https://evil.example/dashboard/x",
      "//evil.example/dashboard/x",
      "/dashboard//evil.example",
      "javascript:alert(1)",
      "dashboard/contacts",
    ]) {
      expect(safeDashboardPath(bad)).toBeNull();
    }
  });

  it("refuses paths outside the dashboard, and look-alikes", () => {
    expect(safeDashboardPath("/account")).toBeNull();
    expect(safeDashboardPath("/dashboardx/contacts")).toBeNull();
    expect(safeDashboardPath("/")).toBeNull();
  });

  it("refuses backslashes, control characters and dot-dot escapes", () => {
    expect(safeDashboardPath("/dashboard/\\evil.example")).toBeNull();
    expect(safeDashboardPath("/dashboard/a\nb")).toBeNull();
    expect(safeDashboardPath("/dashboard/../account")).toBeNull();
  });

  it("refuses nothing, and absurdly long values", () => {
    expect(safeDashboardPath(null)).toBeNull();
    expect(safeDashboardPath("")).toBeNull();
    expect(safeDashboardPath("/dashboard/" + "a".repeat(400))).toBeNull();
  });
});
