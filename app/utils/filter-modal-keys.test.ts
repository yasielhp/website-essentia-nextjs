import { describe, expect, mock, test } from "bun:test";
import { applyOnEnter, shouldApplyOnEnter } from "./filter-modal-keys";

const enter = (over: Partial<Parameters<typeof shouldApplyOnEnter>[0]> = {}) =>
  shouldApplyOnEnter({
    key: "Enter",
    targetTag: "INPUT",
    targetType: "text",
    ...over,
  });

describe("shouldApplyOnEnter", () => {
  test("Enter in a text-like input applies", () => {
    for (const type of [
      "text",
      "search",
      "number",
      "date",
      "datetime-local",
      "email",
      "tel",
      "url",
      "time",
      "month",
      "week",
      "password",
      "",
    ]) {
      expect(enter({ targetType: type })).toBe(true);
    }
  });

  test("an input with no type (the default is text) applies", () => {
    expect(enter({ targetType: undefined })).toBe(true);
    expect(enter({ targetType: null })).toBe(true);
  });

  test("Enter in a select applies", () => {
    expect(enter({ targetTag: "SELECT", targetType: "select-one" })).toBe(true);
  });

  test("the tag is read whatever its case", () => {
    expect(enter({ targetTag: "input" })).toBe(true);
    expect(enter({ targetTag: "Select" })).toBe(true);
  });

  test("Enter in a textarea keeps its new line", () => {
    expect(enter({ targetTag: "TEXTAREA", targetType: "textarea" })).toBe(
      false,
    );
  });

  test("Enter on a button, a link or a summary does what they do", () => {
    expect(enter({ targetTag: "BUTTON", targetType: "button" })).toBe(false);
    expect(enter({ targetTag: "A", targetType: undefined })).toBe(false);
    expect(enter({ targetTag: "SUMMARY" })).toBe(false);
  });

  test("Enter in inputs that are buttons or toggles does what they do", () => {
    for (const type of [
      "checkbox",
      "radio",
      "button",
      "submit",
      "reset",
      "file",
      "image",
      "range",
      "color",
      "hidden",
    ]) {
      expect(enter({ targetType: type })).toBe(false);
    }
  });

  test("Enter that confirms an IME composition does not apply", () => {
    expect(enter({ isComposing: true })).toBe(false);
  });

  test("Enter with a modifier is not a plain Enter", () => {
    expect(enter({ shiftKey: true })).toBe(false);
    expect(enter({ ctrlKey: true })).toBe(false);
    expect(enter({ altKey: true })).toBe(false);
    expect(enter({ metaKey: true })).toBe(false);
  });

  test("a held-down Enter is not repeated", () => {
    expect(enter({ repeat: true })).toBe(false);
  });

  test("other keys never apply", () => {
    for (const key of ["a", " ", "Tab", "Escape", "ArrowDown", "NumpadEnter"]) {
      expect(enter({ key })).toBe(false);
    }
  });

  test("a target with no tag does not apply", () => {
    expect(enter({ targetTag: "" })).toBe(false);
  });
});

// ── the handler, over events shaped like React's ───────────────────────────

function event(
  over: {
    key?: string;
    tag?: string;
    type?: string;
    isComposing?: boolean;
    keyCode?: number;
  } = {},
) {
  const preventDefault = mock(() => {});
  return {
    preventDefault,
    e: {
      key: over.key ?? "Enter",
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      repeat: false,
      defaultPrevented: false,
      nativeEvent: {
        isComposing: over.isComposing ?? false,
        keyCode: over.keyCode ?? 13,
      },
      target: { tagName: over.tag ?? "INPUT", type: over.type ?? "search" },
      preventDefault,
    },
  };
}

describe("applyOnEnter", () => {
  test("Enter in a field applies once and stops the browser's own action", () => {
    const onApply = mock(() => {});
    const { e, preventDefault } = event();
    applyOnEnter(onApply)(e as never);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test("Enter on a button leaves the button to act and applies nothing", () => {
    const onApply = mock(() => {});
    const { e, preventDefault } = event({ tag: "BUTTON", type: "submit" });
    applyOnEnter(onApply)(e as never);
    expect(onApply).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  test("an IME's Enter, including Safari's keyCode 229, applies nothing", () => {
    const onApply = mock(() => {});
    applyOnEnter(onApply)(event({ isComposing: true }).e as never);
    applyOnEnter(onApply)(event({ keyCode: 229 }).e as never);
    expect(onApply).not.toHaveBeenCalled();
  });

  test("an event somebody already handled is left alone", () => {
    const onApply = mock(() => {});
    const { e } = event();
    e.defaultPrevented = true;
    applyOnEnter(onApply)(e as never);
    expect(onApply).not.toHaveBeenCalled();
  });

  test("other keys apply nothing and are not stopped", () => {
    const onApply = mock(() => {});
    const { e, preventDefault } = event({ key: "a" });
    applyOnEnter(onApply)(e as never);
    expect(onApply).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
