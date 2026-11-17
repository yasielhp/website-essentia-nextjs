import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { CONTACT_SAVE_PHRASES, contactSaveError } from "./save-error";

/**
 * The three sentences `updateContact` answers with are English and fixed. The page
 * translates them by comparing with these exact strings, so a test READS the action's
 * file as text and fails if one of them is no longer there: the map cannot drift.
 */
const action = readFileSync(
  join(import.meta.dir, "../../../../actions/contacts.ts"),
  "utf8",
);

describe("the sentences the action answers with", () => {
  test("are still in the action, word for word", () => {
    for (const phrase of Object.values(CONTACT_SAVE_PHRASES)) {
      expect(action).toContain(`"${phrase}"`);
    }
  });
});

describe("contactSaveError", () => {
  test("each of the three is its own kind", () => {
    expect(contactSaveError("The contact details are not valid.")).toBe(
      "invalid",
    );
    expect(contactSaveError("The contact could not be saved.")).toBe("failed");
    expect(
      contactSaveError("Another contact already has this email address."),
    ).toBe("emailTaken");
  });
  test("any other text (a session that lapsed, a message from elsewhere) is the generic failure", () => {
    expect(contactSaveError("Session expired")).toBe("failed");
    expect(
      contactSaveError(
        'duplicate key value violates unique constraint "contacts_email_key"',
      ),
    ).toBe("failed");
    expect(contactSaveError("")).toBe("failed");
  });
  test("a lookalike is not the sentence", () => {
    expect(contactSaveError("the contact could not be saved.")).toBe("failed");
    expect(
      contactSaveError("Another contact already has this email address"),
    ).toBe("failed");
  });
});

describe("the panel's words for them", () => {
  test("each kind has a sentence in Spanish and in English", () => {
    const e = es.contacts.detail.errors;
    expect(e.saveInvalid).toBe("Los datos del contacto no son válidos.");
    expect(e.saveFailed).toBe("No se pudo guardar el contacto.");
    expect(e.emailTaken).toBe("Otro contacto ya tiene ese correo.");
    const n = en.contacts.detail.errors;
    for (const key of ["saveInvalid", "saveFailed", "emailTaken"] as const) {
      expect(n[key]).toBeTruthy();
    }
  });
});
