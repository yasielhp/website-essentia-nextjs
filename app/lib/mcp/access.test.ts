import { describe, expect, it } from "bun:test";
import { TOOL_ACCESS, roleAllowed } from "./access";
import { denyUnless } from "./tool";
import { searchTerm, rangeOf } from "./paging";

const as = (role: string | undefined) => ({
  authInfo: { scopes: ["mcp:read"], extra: { userId: "u1", role } },
});

describe("roleAllowed", () => {
  it("lets a role through only when it is on the list", () => {
    expect(roleAllowed("admin", ["admin"])).toBe(true);
    expect(roleAllowed("staff", ["admin"])).toBe(false);
    expect(roleAllowed("staff", ["admin", "staff"])).toBe(true);
  });

  it("turns away a partner, a client and nobody", () => {
    for (const role of ["partner", "client", "", null, undefined]) {
      expect(roleAllowed(role, ["admin", "staff"])).toBe(false);
    }
  });
});

describe("TOOL_ACCESS", () => {
  it("never lists a partner or any role but admin and staff", () => {
    for (const roles of Object.values(TOOL_ACCESS)) {
      for (const role of roles) expect(["admin", "staff"]).toContain(role);
    }
  });

  it("gives an administrator every tool", () => {
    for (const [name, roles] of Object.entries(TOOL_ACCESS)) {
      expect([name, (roles as readonly string[]).includes("admin")]).toEqual([
        name,
        true,
      ]);
    }
  });

  it("keeps the money, memberships, campaigns, races and courses for administrators", () => {
    for (const name of [
      "list_transactions",
      "list_memberships",
      "list_membership_plans",
      "list_campaigns",
      "get_campaign",
      "list_races",
      "list_race_registrations",
      "list_education_sessions",
      "list_education_enrollees",
    ] as const) {
      expect(TOOL_ACCESS[name]).toEqual(["admin"]);
    }
  });

  it("gives staff the day-to-day: bookings, services, contacts and the blog", () => {
    for (const name of [
      "list_services",
      "get_availability",
      "list_session_types",
      "list_staff",
      "list_bookings",
      "get_booking",
      "create_booking",
      "cancel_booking",
      "search_contacts",
      "get_contact",
      "list_blog_posts",
      "update_blog_post",
    ] as const) {
      expect(TOOL_ACCESS[name]).toContain("staff");
    }
  });
});

describe("denyUnless", () => {
  it("returns nothing for an allowed role", () => {
    expect(denyUnless(as("admin"), ["admin"])).toBeNull();
    expect(denyUnless(as("staff"), ["admin", "staff"])).toBeNull();
  });

  it("returns an error result for any other, and for no authorization at all", () => {
    for (const extra of [as("staff"), as("partner"), as(undefined), {}]) {
      const denied = denyUnless(extra, ["admin"]);
      expect(denied?.isError).toBe(true);
      expect(denied?.content[0]?.text).toContain("Forbidden");
    }
  });

  it("reads the authorization from either place the SDK may put it", () => {
    const authInfo = as("admin").authInfo;
    expect(denyUnless({ authInfo }, ["admin"])).toBeNull();
    expect(denyUnless({ http: { authInfo } }, ["admin"])).toBeNull();
  });
});

describe("paging helpers", () => {
  it("turns limit and offset into an inclusive range", () => {
    expect(rangeOf(20, 0)).toEqual([0, 19]);
    expect(rangeOf(50, 100)).toEqual([100, 149]);
  });

  it("strips what would be read as filter syntax", () => {
    expect(searchTerm("ana,(x)*")).toBe("ana x");
    expect(searchTerm("  Fiona   Smith ")).toBe("Fiona Smith");
    expect(searchTerm("a".repeat(200))).toHaveLength(80);
  });
});
