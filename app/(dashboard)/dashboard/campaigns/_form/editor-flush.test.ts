import { describe, expect, test } from "bun:test";
import type { EmailDoc } from "@/types/campaign";
import { DELAY_MS, createDocFlusher, type Timers } from "./editor-flush";
import {
  formReducer,
  initialFormState,
  type FormAction,
  type FormState,
} from "./form-state";

/** Timers the test fires by hand. */
function manualTimers() {
  let next = 1;
  const due = new Map<number, { run: () => void; ms: number }>();
  const timers: Timers = {
    set: (run, ms) => {
      const id = next++;
      due.set(id, { run, ms });
      return id;
    },
    clear: (id) => {
      due.delete(id as number);
    },
  };
  return {
    timers,
    pending: () => [...due.values()],
    fire: () => {
      const all = [...due.values()];
      due.clear();
      for (const timer of all) timer.run();
    },
  };
}

const doc = (text: string): EmailDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** The form, run by the real reducer, and every action it was sent. */
function form(start: FormState) {
  let state = start;
  const actions: FormAction[] = [];
  return {
    dispatch: (action: FormAction) => {
      actions.push(action);
      state = formReducer(state, action);
    },
    state: () => state,
    actions,
  };
}

const both: FormState = {
  ...initialFormState,
  name: "Reapertura",
  audience: { ...initialFormState.audience, language: "any" },
};

describe("the email editor's words on their way to the form", () => {
  test("typing is told to the form a beat after the last keystroke, once", () => {
    const f = form(both);
    const clock = manualTimers();
    const flusher = createDocFlusher(f.dispatch, clock.timers);
    flusher.typed("es", () => doc("Hol"));
    flusher.typed("es", () => doc("Hola"));
    // Each keystroke replaces the one before: one timer, of the beat's length.
    expect(clock.pending().map((t) => t.ms)).toEqual([DELAY_MS]);
    expect(f.actions).toEqual([]);
    clock.fire();
    expect(f.actions).toEqual([
      { type: "SET_DOC", locale: "es", doc: doc("Hola") },
    ]);
    expect(f.state().content.es.doc).toEqual(doc("Hola"));
  });

  test("switching language writes what was typed, to its own language, before the switch", () => {
    const f = form(both);
    const clock = manualTimers();
    const flusher = createDocFlusher(f.dispatch, clock.timers);
    flusher.typed("es", () => doc("Hola a todas"));
    flusher.switchTo("es", "en");
    expect(f.actions.map((a) => a.type)).toEqual(["SET_DOC", "SET_LOCALE"]);
    expect(f.state().content.es.doc).toEqual(doc("Hola a todas"));
    expect(f.state().content.en.doc).toBeNull();
    expect(f.state().activeLocale).toBe("en");
    // The beat that would have written it again is gone.
    expect(clock.pending()).toEqual([]);
  });

  test("words typed in English after the switch land in English", () => {
    const f = form(both);
    const clock = manualTimers();
    const flusher = createDocFlusher(f.dispatch, clock.timers);
    flusher.typed("es", () => doc("Hola"));
    flusher.switchTo("es", "en");
    flusher.typed("en", () => doc("Hello"));
    flusher.switchTo("en", "es");
    expect(f.state().content.es.doc).toEqual(doc("Hola"));
    expect(f.state().content.en.doc).toEqual(doc("Hello"));
    expect(f.state().activeLocale).toBe("es");
  });

  test("the language already on screen is no switch, and writes nothing", () => {
    const f = form(both);
    const flusher = createDocFlusher(f.dispatch, manualTimers().timers);
    flusher.typed("es", () => doc("Hola"));
    flusher.switchTo("es", "es");
    expect(f.actions).toEqual([]);
  });

  test("a flush with nothing typed answers null and writes nothing", () => {
    const f = form(both);
    const flusher = createDocFlusher(f.dispatch, manualTimers().timers);
    expect(flusher.flush()).toBeNull();
    expect(f.actions).toEqual([]);
  });

  test("a flush answers the action it wrote, for the caller who judges the form next", () => {
    const f = form(both);
    const flusher = createDocFlusher(f.dispatch, manualTimers().timers);
    flusher.typed("en", () => doc("Hello"));
    const written = flusher.flush();
    expect(written).toEqual({
      type: "SET_DOC",
      locale: "en",
      doc: doc("Hello"),
    });
    // Once: a second flush has nothing left.
    expect(flusher.flush()).toBeNull();
    expect(f.actions).toHaveLength(1);
  });
});
