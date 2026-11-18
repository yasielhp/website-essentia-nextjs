import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";

const read = (f: string) => readFileSync(join(import.meta.dir, f), "utf8");

describe("the tabs of Messages", () => {
  test("the automatic messages are the first tab and the default one", () => {
    expect(read("messages-tabs.tsx")).toContain(
      'const TABS: TabKey[] = ["email", "whatsapp"]',
    );
    expect(read("messages-tabs.tsx")).toContain('initialTab = "email"');
    // ?tab=whatsapp opens the templates; anything else (and ?tab=email, from the
    // old links) opens the automatic messages.
    expect(read("page.tsx")).toContain(
      'tab === "whatsapp" ? "whatsapp" : "email"',
    );
  });
  test("the first tab is called 'Automatic messages' in both languages", () => {
    expect(es.messages.tabs.email).toBe("Mensajes automáticos");
    expect(en.messages.tabs.email).toBe("Automatic messages");
  });
});
