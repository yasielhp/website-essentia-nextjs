import { describe, expect, test } from "bun:test";
import { headerActions } from "./header-actions";

const email = (over = {}) =>
  headerActions({
    channel: "email",
    dirty: false,
    saving: false,
    testing: false,
    switching: false,
    hasSaved: false,
    enabled: true,
    canTest: true,
    hasTemplate: true,
    usable: true,
    ...over,
  });

const whatsapp = (over = {}) =>
  headerActions({
    channel: "whatsapp",
    dirty: false,
    saving: false,
    testing: false,
    switching: false,
    hasSaved: true,
    enabled: true,
    canTest: true,
    hasTemplate: true,
    usable: true,
    ...over,
  });

describe("the email page's actions", () => {
  test("nothing changed: the test can be sent, there is nothing to save, nothing to reset", () => {
    expect(email()).toEqual({
      test: { disabled: false, busy: false },
      save: { disabled: true, busy: false },
      reset: { shown: false, disabled: false },
      help: "testNote",
    });
  });
  test("with changes: Save is on, the test waits for it and says why", () => {
    const out = email({ dirty: true });
    expect(out.save.disabled).toBe(false);
    expect(out.test.disabled).toBe(true);
    expect(out.help).toBe("saveFirst");
  });
  test("saving: both are off and Save says it is busy", () => {
    const out = email({ dirty: true, saving: true });
    expect(out.save).toEqual({ disabled: true, busy: true });
    expect(out.test.disabled).toBe(true);
    expect(email({ hasSaved: true, saving: true }).reset.disabled).toBe(true);
  });
  test("testing: the test is busy and off, Save is still off for a clean form", () => {
    const out = email({ testing: true });
    expect(out.test).toEqual({ disabled: true, busy: true });
    expect(out.save.disabled).toBe(true);
  });
  test("the reminder's switch in flight keeps Save from running beside it", () => {
    expect(email({ dirty: true, switching: true }).save.disabled).toBe(true);
  });
  test("Reset is offered once there is a text of one's own, or the reminder is switched off", () => {
    expect(email({ hasSaved: true }).reset.shown).toBe(true);
    expect(email({ enabled: false }).reset.shown).toBe(true);
    expect(email({ hasSaved: false, enabled: true }).reset.shown).toBe(false);
  });
});

describe("the WhatsApp page's actions", () => {
  test("a saved template can be tested; Save waits for a change", () => {
    const out = whatsapp();
    expect(out.test.disabled).toBe(false);
    expect(out.save.disabled).toBe(true);
    expect(out.reset.shown).toBe(true);
  });
  test("without the WhatsApp account, or without a saved template, there is nothing to test", () => {
    expect(whatsapp({ canTest: false }).test.disabled).toBe(true);
    expect(whatsapp({ hasTemplate: false }).test.disabled).toBe(true);
  });
  test("Save needs a change and a template that can be used", () => {
    expect(whatsapp({ dirty: true }).save.disabled).toBe(false);
    expect(whatsapp({ dirty: true, usable: false }).save.disabled).toBe(true);
    expect(whatsapp({ dirty: true }).help).toBe("saveFirst");
  });
  test("nothing saved yet: no Remove, whatever else", () => {
    expect(whatsapp({ hasSaved: false }).reset.shown).toBe(false);
    expect(whatsapp({ enabled: false, hasSaved: false }).reset.shown).toBe(
      false,
    );
  });
});
