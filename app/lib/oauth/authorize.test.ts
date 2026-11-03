import { describe, expect, it } from "bun:test";
import { checkAuthorizeRequest } from "./authorize";

const client = {
  clientId: "c1",
  redirectUris: ["https://a.example/cb"],
};
const RESOURCE = "https://app.example/api/mcp";
const good = {
  client_id: "c1",
  redirect_uri: "https://a.example/cb",
  response_type: "code",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  state: "xyz",
};

describe("checkAuthorizeRequest", () => {
  it("accepts a complete, well-formed request", () => {
    const result = checkAuthorizeRequest(good, client, RESOURCE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.params.state).toBe("xyz");
      expect(result.params.resource).toBeNull();
    }
  });

  it("is fatal — never redirected — for an unknown client", () => {
    expect(checkAuthorizeRequest(good, null, RESOURCE)).toEqual({
      ok: false,
      kind: "fatal",
    });
    expect(
      checkAuthorizeRequest({ ...good, client_id: "other" }, client, RESOURCE),
    ).toEqual({ ok: false, kind: "fatal" });
  });

  it("is fatal for a redirect address that is not registered, exactly", () => {
    for (const uri of [
      "https://evil.example/cb",
      "https://a.example/cb/",
      "https://a.example/cb?x=1",
      "",
    ]) {
      expect(
        checkAuthorizeRequest({ ...good, redirect_uri: uri }, client, RESOURCE),
      ).toEqual({ ok: false, kind: "fatal" });
    }
  });

  it("sends the other mistakes back to the client, with its state", () => {
    const wrongType = checkAuthorizeRequest(
      { ...good, response_type: "token" },
      client,
      RESOURCE,
    );
    expect(wrongType).toMatchObject({
      ok: false,
      kind: "redirect",
      error: "unsupported_response_type",
      state: "xyz",
    });

    for (const bad of [
      { code_challenge_method: "plain" },
      { code_challenge_method: undefined },
      { code_challenge: undefined },
      { code_challenge: "short" },
    ]) {
      expect(
        checkAuthorizeRequest({ ...good, ...bad }, client, RESOURCE),
      ).toMatchObject({
        ok: false,
        kind: "redirect",
        error: "invalid_request",
      });
    }
  });

  it("checks the resource only when one is named", () => {
    expect(
      checkAuthorizeRequest(
        { ...good, resource: `${RESOURCE}/` },
        client,
        RESOURCE,
      ).ok,
    ).toBe(true);
    expect(
      checkAuthorizeRequest(
        { ...good, resource: "https://other.example/mcp" },
        client,
        RESOURCE,
      ),
    ).toMatchObject({ ok: false, kind: "redirect", error: "invalid_target" });
  });
});
