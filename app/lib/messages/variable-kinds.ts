import type { FixedBlock, MessageVariable } from "./catalog";

/**
 * What each variable stands for, and what each block the system adds carries,
 * over plain values: the editor draws an icon and a soft colour by kind, so a
 * variable reads the same wherever it is on the page (the chips, the cards of
 * the blocks). Pure and light enough for the browser.
 */

export const VARIABLE_KINDS = [
  "person",
  "service",
  "session",
  "date",
  "time",
  "duration",
  "money",
  "link",
] as const;

export type VariableKind = (typeof VARIABLE_KINDS)[number];

const KIND_OF: Record<MessageVariable, VariableKind> = {
  first_name: "person",
  service: "service",
  session_type: "session",
  date: "date",
  time: "time",
  duration: "duration",
  amount_due: "money",
  amount_paid: "money",
  sessions: "session",
  expires_on: "date",
  cancel_url: "link",
  consent_url: "link",
};

/** The kind of a variable, or null for a name the catalogue does not have. */
export function variableKind(name: string): VariableKind | null {
  return Object.hasOwn(KIND_OF, name) ? KIND_OF[name as MessageVariable] : null;
}

export type BlockIcon =
  | "details"
  | "location"
  | "money"
  | "calendar"
  | "link"
  | "consent"
  | "voucher";

/** What a block of the system carries: its icon and the variables it fills. */
export const BLOCK_INFO: Record<
  FixedBlock,
  { icon: BlockIcon; variables: MessageVariable[] }
> = {
  details_card: {
    icon: "details",
    variables: [
      "service",
      "session_type",
      "date",
      "time",
      "duration",
      "amount_paid",
    ],
  },
  location: { icon: "location", variables: [] },
  payment_note: { icon: "money", variables: ["amount_due"] },
  calendar_button: { icon: "calendar", variables: [] },
  cancel_link: { icon: "link", variables: ["cancel_url"] },
  consent_button: { icon: "consent", variables: ["consent_url"] },
  bonus_card: {
    icon: "voucher",
    variables: ["service", "sessions", "amount_paid", "expires_on"],
  },
};

export type BlockCard = {
  block: FixedBlock;
  icon: BlockIcon;
  /** The variables the block fills that this message offers. */
  variables: MessageVariable[];
};

/**
 * The blocks the system adds to a message, in the order they come out (the
 * catalogue's), each with the variables of the message it carries.
 */
export function blockCards(
  fixed: readonly FixedBlock[],
  offered: readonly MessageVariable[],
): BlockCard[] {
  return fixed.map((block) => ({
    block,
    icon: BLOCK_INFO[block].icon,
    variables: BLOCK_INFO[block].variables.filter((v) => offered.includes(v)),
  }));
}
