import { describe, expect, it } from "bun:test";
import {
  accessDecision,
  authorizationRedirect,
  codeDecision,
  grantedScopes,
  isValidChallenge,
  isValidRedirectUri,
  isValidVerifier,
  newSecret,
  pkceChallenge,
  redirectUriAllowed,
  refreshDecision,
  sha256Hex,
  verifyPkce,
} from "./core";

// The worked example from RFC 7636, appendix B.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("PKCE", () => {
  it("derives the S256 challenge of the RFC's example", () => {
    expect(pkceChallenge(VERIFIER)).toBe(CHALLENGE);
    expect(isValidChallenge(CHALLENGE)).toBe(true);
  });

  it("accepts the right verifier and refuses any other", () => {
    expect(verifyPkce(VERIFIER, CHALLENGE)).toBe(true);
    expect(verifyPkce(VERIFIER.replace("d", "e"), CHALLENGE)).toBe(false);
    expect(verifyPkce(VERIFIER, CHALLENGE.slice(0, -1) + "x")).toBe(false);
  });

  it("refuses a verifier of the wrong shape before comparing anything", () => {
    expect(isValidVerifier("short")).toBe(false);
    expect(isValidVerifier("a".repeat(129))).toBe(false);
    expect(isValidVerifier("a".repeat(42) + "!")).toBe(false);
    expect(verifyPkce("short", pkceChallenge("short"))).toBe(false);
  });
});

describe("redirect URIs", () => {
  it("accepts https and local loopback http", () => {
    expect(isValidRedirectUri("https://chatgpt.com/connector/oauth/abc")).toBe(
      true,
    );
    expect(isValidRedirectUri("http://localhost:6274/callback")).toBe(true);
    expect(isValidRedirectUri("http://127.0.0.1:3000/cb")).toBe(true);
  });

  it("refuses plain http elsewhere, custom schemes, fragments and credentials", () => {
    for (const bad of [
      "http://example.com/cb",
      "myapp://callback",
      "javascript:alert(1)",
      "https://example.com/cb#frag",
      "https://user:pass@example.com/cb",
      "not a url",
      "",
    ]) {
      expect(isValidRedirectUri(bad)).toBe(false);
    }
  });

  it("matches the registered list exactly", () => {
    const list = ["https://a.example/cb"];
    expect(redirectUriAllowed(list, "https://a.example/cb")).toBe(true);
    expect(redirectUriAllowed(list, "https://a.example/cb/")).toBe(false);
    expect(redirectUriAllowed(list, "https://a.example/cb?x=1")).toBe(false);
    expect(redirectUriAllowed(list, "https://A.example/cb")).toBe(false);
  });

  it("adds response parameters and keeps the ones already there", () => {
    expect(
      authorizationRedirect("https://a.example/cb?keep=1", {
        code: "c",
        state: "s",
        skipped: undefined,
      }),
    ).toBe("https://a.example/cb?keep=1&code=c&state=s");
  });
});

describe("scopes", () => {
  it("grants everything a dashboard role may when none are asked for", () => {
    expect(grantedScopes(undefined, "admin")).toEqual([
      "mcp:read",
      "blog:write",
    ]);
    expect(grantedScopes("", "staff")).toEqual(["mcp:read", "blog:write"]);
  });

  it("grants only what was asked for, and only what exists", () => {
    expect(grantedScopes("mcp:read", "admin")).toEqual(["mcp:read"]);
    expect(grantedScopes("mcp:read nonsense", "admin")).toEqual(["mcp:read"]);
  });

  it("grants nothing to anyone else", () => {
    expect(grantedScopes("mcp:read", "partner")).toEqual([]);
    expect(grantedScopes(undefined, null)).toEqual([]);
  });
});

describe("authorization codes", () => {
  const now = new Date("2026-12-01T10:00:00Z");
  const row = {
    clientId: "c1",
    redirectUri: "https://a.example/cb",
    codeChallenge: CHALLENGE,
    expiresAt: "2026-12-01T10:05:00Z",
    usedAt: null,
  };
  const presented = {
    clientId: "c1",
    redirectUri: "https://a.example/cb",
    verifier: VERIFIER,
  };

  it("exchanges a fresh code with everything matching", () => {
    expect(codeDecision(row, now, presented)).toBe("ok");
  });

  it("refuses a code that was already used", () => {
    expect(
      codeDecision({ ...row, usedAt: "2026-12-01T10:01:00Z" }, now, presented),
    ).toBe("used");
  });

  it("refuses an expired code, at the very instant it expires", () => {
    expect(codeDecision(row, new Date("2026-12-01T10:05:00Z"), presented)).toBe(
      "expired",
    );
    expect(codeDecision(row, new Date("2026-12-01T10:04:59Z"), presented)).toBe(
      "ok",
    );
  });

  it("refuses another client, another redirect URI and a wrong verifier", () => {
    expect(codeDecision(row, now, { ...presented, clientId: "c2" })).toBe(
      "client_mismatch",
    );
    expect(
      codeDecision(row, now, {
        ...presented,
        redirectUri: "https://a.example/other",
      }),
    ).toBe("redirect_mismatch");
    expect(
      codeDecision(row, now, { ...presented, verifier: "x".repeat(43) }),
    ).toBe("pkce_failed");
  });
});

describe("access and refresh tokens", () => {
  const now = new Date("2026-12-01T10:00:00Z");

  it("an access token is good until it expires or is revoked", () => {
    expect(
      accessDecision(
        { expiresAt: "2026-12-01T11:00:00Z", revokedAt: null },
        now,
      ),
    ).toBe("ok");
    expect(
      accessDecision(
        { expiresAt: "2026-12-01T10:00:00Z", revokedAt: null },
        now,
      ),
    ).toBe("expired");
    expect(
      accessDecision(
        {
          expiresAt: "2026-12-01T11:00:00Z",
          revokedAt: "2026-12-01T09:00:00Z",
        },
        now,
      ),
    ).toBe("revoked");
  });

  it("a refresh token works once: after rotation the old row is revoked", () => {
    const fresh = {
      refreshExpiresAt: "2027-01-01T00:00:00Z",
      revokedAt: null,
      clientId: "c1",
    };
    expect(refreshDecision(fresh, now, "c1")).toBe("ok");
    expect(
      refreshDecision(
        { ...fresh, revokedAt: "2026-12-01T09:00:00Z" },
        now,
        "c1",
      ),
    ).toBe("revoked");
  });

  it("a refresh token is refused for another client or after it expires", () => {
    const row = {
      refreshExpiresAt: "2027-01-01T00:00:00Z",
      revokedAt: null,
      clientId: "c1",
    };
    expect(refreshDecision(row, now, "c2")).toBe("client_mismatch");
    expect(
      refreshDecision(
        { ...row, refreshExpiresAt: "2026-11-30T00:00:00Z" },
        now,
        "c1",
      ),
    ).toBe("expired");
  });
});

describe("secrets", () => {
  it("hashes deterministically and never returns the value", () => {
    expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
    expect(sha256Hex("abc")).not.toContain("abc");
    expect(sha256Hex("abc")).toHaveLength(64);
  });

  it("makes long, different secrets each time", () => {
    const a = newSecret();
    const b = newSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(/^[A-Za-z0-9\-_]+$/.test(a)).toBe(true);
  });
});
