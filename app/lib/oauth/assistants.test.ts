import { describe, expect, it } from "bun:test";
import { assistantOf, groupConnections } from "./assistants";

const row = (
  id: string,
  clientName: string,
  createdAt: string,
  lastUsedAt: string | null = null,
) => ({ id, clientName, createdAt, lastUsedAt });

describe("assistantOf", () => {
  it("recognises ChatGPT and OpenAI, whatever the case", () => {
    expect(assistantOf("ChatGPT")).toBe("chatgpt");
    expect(assistantOf("OpenAI MCP")).toBe("chatgpt");
    expect(assistantOf("chatgpt connector")).toBe("chatgpt");
  });

  it("recognises Claude and Anthropic", () => {
    expect(assistantOf("Claude")).toBe("claude");
    expect(assistantOf("Anthropic Desktop")).toBe("claude");
  });

  it("leaves anything else unclassified", () => {
    expect(assistantOf("Cursor")).toBeNull();
    expect(assistantOf("")).toBeNull();
  });
});

describe("groupConnections", () => {
  it("is empty when there is nothing", () => {
    expect(groupConnections([])).toEqual({
      chatgpt: null,
      claude: null,
      others: [],
    });
  });

  it("folds several rows of one assistant into one, with the newest date", () => {
    const grouped = groupConnections([
      row("a", "ChatGPT", "2026-11-01T10:00:00Z", "2026-11-02T10:00:00Z"),
      row("b", "ChatGPT", "2026-11-03T10:00:00Z", null),
      row("c", "OpenAI", "2026-11-02T10:00:00Z", "2026-11-04T10:00:00Z"),
    ]);
    expect(grouped.chatgpt).toEqual({
      name: "ChatGPT",
      createdAt: "2026-11-03T10:00:00Z",
      lastUsedAt: "2026-11-04T10:00:00Z",
      ids: ["a", "b", "c"],
    });
    expect(grouped.claude).toBeNull();
  });

  it("keeps the two assistants apart", () => {
    const grouped = groupConnections([
      row("a", "ChatGPT", "2026-11-01T10:00:00Z"),
      row("b", "Claude", "2026-11-02T10:00:00Z"),
    ]);
    expect(grouped.chatgpt?.ids).toEqual(["a"]);
    expect(grouped.claude?.ids).toEqual(["b"]);
  });

  it("lists the unrecognised ones by name, newest first, folding repeats", () => {
    const grouped = groupConnections([
      row("a", "Cursor", "2026-11-01T10:00:00Z"),
      row("b", "cursor", "2026-11-02T10:00:00Z"),
      row("c", "Zed", "2026-11-03T10:00:00Z"),
    ]);
    expect(grouped.others.map((g) => g.name)).toEqual(["Zed", "cursor"]);
    expect(grouped.others[1]?.ids).toEqual(["a", "b"]);
  });

  it("reports no use when none of the rows was ever used", () => {
    const grouped = groupConnections([
      row("a", "Claude", "2026-11-01T10:00:00Z"),
    ]);
    expect(grouped.claude?.lastUsedAt).toBeNull();
  });
});
