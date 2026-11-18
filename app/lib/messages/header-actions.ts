/**
 * Which buttons the header of a message's page shows and in what state, over
 * plain values: Send me a test, Save, and Reset (or Remove, on WhatsApp). One
 * place decides it for both channels, so the states cannot drift apart and a test
 * can pin them.
 */

export type HeaderActionsInput = {
  channel: "email" | "whatsapp";
  /** There is something unsaved in the form. */
  dirty: boolean;
  saving: boolean;
  testing: boolean;
  /** The admin has saved something here (a text, or a WhatsApp notice). */
  hasSaved: boolean;
  /** WhatsApp only: the server has an account to send through. */
  canTest: boolean;
  /** WhatsApp only: a template is saved, so there is something to test. */
  hasTemplate: boolean;
  /** WhatsApp only: the chosen template can still be used. */
  usable: boolean;
};

export type HeaderActions = {
  test: { disabled: boolean; busy: boolean };
  save: { disabled: boolean; busy: boolean };
  reset: { shown: boolean; disabled: boolean };
  /** The line under the title: why the test waits, or what the test does. */
  help: "saveFirst" | "testNote";
};

export function headerActions(input: HeaderActionsInput): HeaderActions {
  const { channel, dirty, saving, testing } = input;
  const whatsapp = channel === "whatsapp";
  return {
    test: {
      disabled:
        saving ||
        testing ||
        dirty ||
        (whatsapp && (!input.canTest || !input.hasTemplate)),
      busy: testing,
    },
    save: {
      disabled: !dirty || saving || (whatsapp && !input.usable),
      busy: saving,
    },
    reset: {
      shown: input.hasSaved,
      disabled: saving,
    },
    help: dirty ? "saveFirst" : "testNote",
  };
}
